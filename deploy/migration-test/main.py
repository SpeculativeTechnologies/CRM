#!/usr/bin/env python3
"""Freeze a baseline, then restore it for every attempt. See MIGRATION-TESTING.md."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import socket
import time

from checks import assert_plan, assert_status, drain_queues, smoke
from stack import ROOT, Stack, cleanup, docker, execute, guard


def checksum(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def validate_manifest(directory):
    manifest = json.loads((directory / 'baseline.json').read_text())
    if manifest.get('format') != 1 or manifest.get('kind') not in ['fixture', 'mirror']:
        raise RuntimeError('Unsupported baseline manifest')
    if not re.fullmatch('[0-9a-f]{40}', manifest.get('source_sha', '')):
        raise RuntimeError('Baseline source revision is missing')
    if checksum(directory / 'baseline.dump') != manifest['dump_sha256']:
        raise RuntimeError('Baseline checksum changed; refusing to reuse it')
    return manifest


def resolve_image(image, source_sha=None):
    docker('pull', image) if '@sha256:' in image else None
    metadata = json.loads(docker('image', 'inspect', image).stdout)[0]
    revision = metadata['Config'].get('Labels', {}).get('org.opencontainers.image.revision')
    bootstrap = json.loads((ROOT / 'deploy/migration-baseline.json').read_text())
    approved_bootstrap = image == bootstrap['image'] and source_sha == bootstrap['source_sha']
    if source_sha and revision != source_sha and not approved_bootstrap:
        raise RuntimeError('Image revision label does not match the baseline source SHA')
    # Resolve local tags to immutable content IDs before starting any process.
    return metadata['Id']


def restore(stack, dump, create=True):
    with Path(dump).open('rb') as stream:
        # pg_dump --create preserves database settings/ACLs. The only supported
        # owner/role is the developer postgres role, never a cloud role/password.
        import subprocess
        result = subprocess.run(['docker', 'exec', '-i', f'{stack.name}-db', 'pg_restore',
                                 '-U', 'postgres', '-d', 'postgres' if create else 'default', '--clean', '--if-exists',
                                 *(['--create'] if create else []), '--exit-on-error', '--no-owner', '--no-privileges'],
                                stdin=stream, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return result


def metadata(stack):
    return {
        'postgres_version': stack.sql('SHOW server_version;'),
        'wal_level': stack.sql('SHOW wal_level;'),
        'extensions': stack.sql('SELECT extname || \':\' || extversion FROM pg_extension ORDER BY extname;').splitlines(),
        'database_settings': stack.sql('SELECT coalesce(array_to_string(setconfig, \',\'), \'\') FROM pg_db_role_setting WHERE setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database());').splitlines(),
        'roles': ['postgres (developer superuser; local-only password)'],
    }


def status(stack):
    output = stack.phase('upgrade-status', lambda: stack.command('upgrade:status'))
    assert_status(output.stdout.decode())
    output = stack.phase('upgrade-plan', lambda: stack.command('upgrade', '--dry-run'))
    assert_plan(output.stdout.decode())


def freeze(args, stack):
    destination = Path(args.baseline).resolve()
    if destination.exists():
        raise RuntimeError('Baseline already exists; choose a new identifier when refreshing')
    if not re.fullmatch('[0-9a-f]{40}', args.source_sha):
        raise RuntimeError('--source-sha must be the matching full source revision')
    stack.phase('services', stack.start)
    if args.dump:
        stack.phase('restore-mirror', lambda: restore(stack, args.dump, create=False))
        stack.sql((ROOT / 'deploy/devdata-verify.sql').read_text())
        # The legacy mirror git_sha names the scrubber checkout, not production.
        # --source-sha must come from the backup's release provenance.
    else:
        stack.image = resolve_image(args.image, args.source_sha)
        stack.phase('initialize', lambda: stack.app('dist/database/scripts/setup-db.js'))
        stack.phase('instance-initialize', lambda: stack.command('run-instance-commands', '--force', '--include-slow'))
        seeded = stack.phase('seed', lambda: stack.command('workspace:seed:dev'))
        if re.search(r'\bERROR\b', seeded.stdout.decode() + seeded.stderr.decode()):
            raise RuntimeError('Seeder logged an error despite its exit status; baseline refused')
        stack.phase('baseline-upgrade', lambda: stack.command('upgrade'))
        status(stack)
        stack.sql('''DO $$ DECLARE schema_name text; table_name text; records bigint; BEGIN
          FOR schema_name IN SELECT "databaseSchema" FROM core.workspace LOOP
            FOREACH table_name IN ARRAY ARRAY['company','person','task','note','opportunity','workspaceMember'] LOOP
              EXECUTE format('SELECT count(*) FROM %I.%I', schema_name, table_name) INTO records;
              IF records = 0 THEN RAISE EXCEPTION 'Synthetic baseline is missing required records'; END IF;
            END LOOP;
          END LOOP;
        END $$;''')
    details = metadata(stack)
    destination.mkdir(parents=True, mode=0o700)
    dump_path = destination / 'baseline.dump'
    result = docker('exec', f'{stack.name}-db', 'pg_dump', '-U', 'postgres', '-d', 'default', '-Fc', '--create')
    dump_path.write_bytes(result.stdout)
    manifest = dict(format=1, kind='mirror' if args.dump else 'fixture', source_sha=args.source_sha,
                    image=args.image, image_id=stack.image, created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                    dump_sha256=checksum(dump_path), postgres_image=stack.postgres,
                    redis_image=stack.redis, **details)
    (destination / 'baseline.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'[migration-test] frozen baseline {destination}; checksum {manifest["dump_sha256"]}')


def run(args, stack):
    baseline = Path(args.baseline).resolve()
    manifest = validate_manifest(baseline)
    stack.postgres = manifest['postgres_image']
    stack.redis = manifest['redis_image']
    stack.phase('services', stack.start)
    stack.phase('restore', lambda: restore(stack, baseline / 'baseline.dump'))
    if metadata(stack) != {key: manifest[key] for key in ['postgres_version', 'wal_level', 'extensions', 'database_settings', 'roles']}:
        raise RuntimeError('Restored PostgreSQL version/extensions/settings differ from baseline')
    if manifest['kind'] == 'mirror':
        stack.sql((ROOT / 'deploy/devdata-verify.sql').read_text())
    image = args.image
    if args.build:
        image = 'twenty-migration-build:' + stack.name
        revision = execute(['git', '-C', str(ROOT), 'rev-parse', 'HEAD']).stdout.decode().strip()
        stack.phase('build', lambda: docker('build', '--target', 'twenty' if args.preview else 'twenty-server',
                    '--label', f'org.opencontainers.image.revision={revision}', '-t', image,
                    '-f', str(ROOT / 'packages/twenty-docker/twenty/Dockerfile'), str(ROOT), check=False))
    stack.image = resolve_image(image)
    for name, command in [('instance-upgrade', ['run-instance-commands', '--force', '--include-slow']),
                          ('workspace-upgrade', ['upgrade']), ('cache-flush', ['cache:flush'])]:
        stack.phase(name, lambda command=command: stack.command(*command))
    if args.port == 0:
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            args.port = listener.getsockname()[1]
    stack.environment['ENVIRONMENT_LABEL'] = 'migration rehearsal'
    stack.environment['SERVER_URL'] = f'http://localhost:{args.port or 3000}'
    stack.phase('api-start', lambda: stack.app('dist/main', service='api'))
    stack.phase('preview-proxy', lambda: stack.expose(args.port))
    stack.phase('worker-start', lambda: stack.app('dist/queue-worker/queue-worker', service='worker'))
    stack.phase('background-work', lambda: drain_queues(stack, args.timeout))
    status(stack)
    for service in ['api', 'worker']:
        state = json.loads(docker('inspect', f'{stack.name}-{service}').stdout)[0]['State']
        if not state['Running']:
            raise RuntimeError(f'{service} exited during migration verification')
    preview_url = stack.phase('application-smoke', lambda: smoke(stack, args.preview, manifest['kind'] == 'fixture'))
    if args.assert_sql:
        stack.phase('behavior-assertions', lambda: stack.sql(Path(args.assert_sql).read_text()))
    stack.phase('post-smoke-background-work', lambda: drain_queues(stack, args.timeout))
    if checksum(baseline / 'baseline.dump') != manifest['dump_sha256']:
        raise RuntimeError('Frozen baseline changed during the attempt')
    summary = dict(result='passed', source_sha=execute(['git', '-C', str(ROOT), 'rev-parse', 'HEAD']).stdout.decode().strip(),
                   image=image, image_id=stack.image, baseline_sha=manifest['source_sha'],
                   baseline_checksum=manifest['dump_sha256'], migration_status='up to date',
                   preview_url=preview_url, timings=stack.timings)
    (stack.directory / 'result.json').write_text(json.dumps(summary, indent=2) + '\n')


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='action', required=True)
    frozen = commands.add_parser('freeze')
    frozen.add_argument('--baseline', required=True)
    frozen.add_argument('--source-sha', required=True)
    source = frozen.add_mutually_exclusive_group(required=True)
    source.add_argument('--image', help='Immutable image with matching OCI revision label')
    source.add_argument('--dump', help='Verified scrubbed mirror; never a raw production dump')
    attempt = commands.add_parser('run')
    attempt.add_argument('--baseline', required=True)
    target = attempt.add_mutually_exclusive_group(required=True)
    target.add_argument('--image')
    target.add_argument('--build', action='store_true')
    attempt.add_argument('--assert-sql', help='Branch-specific assertions; RAISE on wrong data')
    attempt.add_argument('--preview', action='store_true', help='Verify frontend runtime configuration')
    attempt.add_argument('--port', type=int, default=0, help='Loopback preview port; 0 chooses a free port')
    attempt.add_argument('--timeout', type=int, default=300)
    for command in [frozen, attempt]:
        command.add_argument('--logs', default=str(ROOT / 'deploy/.migration-tests' / time.strftime('%Y%m%d-%H%M%S')))
        command.add_argument('--keep', action='store_true')
    reset = commands.add_parser('reset', help='Remove a retained attempt; the next run restores the original baseline')
    reset.add_argument('--logs', required=True)
    args = parser.parse_args()
    guard()
    if args.action == 'reset':
        cleanup(json.loads((Path(args.logs) / 'resources.json').read_text())['name'])
        return
    stack = Stack(args.logs)
    try:
        freeze(args, stack) if args.action == 'freeze' else run(args, stack)
    except Exception as error:
        if hasattr(error, 'output'):
            (stack.directory / 'failure.log').write_bytes(error.output)
        (stack.directory / 'result.json').write_text(json.dumps({'result': 'failed', 'error': str(error), 'timings': stack.timings}, indent=2))
        raise
    finally:
        stack.logs()
        if not args.keep:
            stack.close()
        print(f'[migration-test] private diagnostics: {stack.directory}')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError) as error:
        print(f'[migration-test] FAIL: {error}', file=sys.stderr)
        sys.exit(1)
