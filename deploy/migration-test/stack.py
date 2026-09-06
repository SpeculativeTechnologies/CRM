"""Disposable, local-only Docker resources for migration rehearsals."""
import json
import os
from pathlib import Path
import re
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
LABEL = 'tech.spec.migration-test'


class ProcessFailure(RuntimeError):
    def __init__(self, arguments, result):
        super().__init__(f'{arguments[0]} failed with exit {result.returncode}')
        self.output = result.stdout + result.stderr


def execute(arguments, *, input=None, check=True):
    result = subprocess.run(arguments, input=input, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE)
    if check and result.returncode:
        # Raw app/database errors belong in private diagnostics, never stdout.
        raise ProcessFailure(arguments, result)
    return result


def docker(*arguments, **kwargs):
    return execute(['docker', *arguments], **kwargs)


def guard():
    if Path('/opt/twenty/.env.cloud').exists():
        raise RuntimeError('Environment guard: cloud host detected')
    context = json.loads(docker('context', 'inspect').stdout)[0]
    endpoint = os.environ.get('DOCKER_HOST', context['Endpoints']['docker']['Host'])
    if not endpoint.startswith('unix://'):
        raise RuntimeError('Environment guard: only a local Unix Docker socket is allowed')
    docker('info')


def wait_for(check, timeout=120):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if check():
            return
        time.sleep(2)
    raise RuntimeError(f'Readiness check timed out after {timeout}s')


class Stack:
    def __init__(self, directory, postgres='postgres:16', redis='redis:7-alpine'):
        self.directory = Path(directory).resolve()
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.name = 'twenty-migration-' + uuid.uuid4().hex[:12]
        self.postgres = postgres
        self.redis = redis
        self.image = None
        self.timings = {}
        self.environment = {
            'PG_DATABASE_URL': 'postgres://postgres:postgres@db:5432/default',
            'REDIS_URL': 'redis://redis:6379',
            'APP_SECRET': uuid.uuid4().hex + uuid.uuid4().hex,
            'NODE_ENV': 'development', 'NODE_PORT': '3000',
            'SERVER_URL': 'http://localhost:3000', 'STORAGE_TYPE': 'local',
            'DISABLE_DB_MIGRATIONS': 'true',
            'DISABLE_CRON_JOBS_REGISTRATION': 'true',
            'IS_BILLING_ENABLED': 'false', 'SIGN_IN_PREFILLED': 'true',
            'IS_CONFIG_VARIABLES_IN_DB_ENABLED': 'false',
            'EMAIL_DRIVER': 'LOGGER', 'LOGIC_FUNCTION_TYPE': 'DISABLED',
            'MESSAGING_PROVIDER_GMAIL_ENABLED': 'false',
            'CALENDAR_PROVIDER_GOOGLE_ENABLED': 'false',
            'PG_DATABASE_PRIMARY_TIMEOUT_MS': '1800000',
            'TELEMETRY_ENABLED': 'false', 'NO_COLOR': '1',
        }
        (self.directory / 'resources.json').write_text(json.dumps({'name': self.name}))

    def phase(self, name, function):
        start = time.monotonic()
        try:
            result = function()
            if hasattr(result, 'stdout'):
                (self.directory / f'{name}.log').write_bytes(result.stdout + result.stderr)
                if result.returncode:
                    raise RuntimeError(f'{name} failed; inspect private diagnostics')
            return result
        except ProcessFailure as error:
            (self.directory / f'{name}.log').write_bytes(error.output)
            raise
        finally:
            self.timings[name] = round(time.monotonic() - start, 3)
            (self.directory / 'timings.json').write_text(json.dumps(self.timings, indent=2))
            print(f'[migration-test] {name}: {self.timings[name]}s', flush=True)

    def start(self):
        docker('network', 'create', '--internal', '--label', LABEL, self.name)
        for service, image, variables in [
            ('db', self.postgres, {'POSTGRES_PASSWORD': 'postgres', 'POSTGRES_DB': 'default'}),
            ('redis', self.redis, {}),
        ]:
            docker('pull', image)
            resolved = json.loads(docker('image', 'inspect', image).stdout)[0]
            image = resolved['RepoDigests'][0]
            if service == 'db':
                self.postgres = image
            else:
                self.redis = image
            arguments = ['run', '-d', '--name', f'{self.name}-{service}', '--label', LABEL,
                         '--network', self.name, '--network-alias', service]
            for key, value in variables.items():
                arguments.extend(['-e', f'{key}={value}'])
            extra = ['postgres', '-c', 'wal_level=logical'] if service == 'db' else ['redis-server', '--maxmemory-policy', 'noeviction']
            docker(*arguments, image, *extra)
        # The image's temporary initialization server accepts Unix sockets and
        # then shuts down. Only the final server accepts TCP connections.
        wait_for(lambda: docker('exec', f'{self.name}-db', 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres',
                                check=False).returncode == 0)
        wait_for(lambda: docker('exec', f'{self.name}-redis', 'redis-cli', 'ping',
                                check=False).stdout.strip() == b'PONG')

    def sql(self, query, database='default'):
        return docker('exec', '-i', f'{self.name}-db', 'psql', '-X', '-U', 'postgres',
                      '-d', database, '-v', 'ON_ERROR_STOP=1', '-At', input=query.encode()).stdout.decode().strip()

    def app(self, *command, service=None, port=None):
        arguments = ['run', '--label', LABEL, '--network', self.name]
        if service:
            arguments += ['-d', '--name', f'{self.name}-{service}', '--network-alias', service]
        else:
            arguments += ['--rm']
        if port is not None:
            arguments += ['-p', f'127.0.0.1:{port}:3000']
        for key, value in self.environment.items():
            arguments += ['-e', f'{key}={value}']
        return docker(*arguments, '--entrypoint', 'node', self.image, *command, check=False)

    def expose(self, port):
        # Keep the application off the Internet. Only this fixed reverse proxy
        # joins both networks; it cannot forward requests to arbitrary hosts.
        image = 'nginx:alpine'
        docker('pull', image)
        configuration = self.directory / 'nginx.conf'
        configuration.write_text('events {} http { server { listen 80; location / { '
                                 'proxy_pass http://api:3000; proxy_set_header Host $http_host; '
                                 'proxy_set_header Upgrade $http_upgrade; '
                                 'proxy_set_header Connection "upgrade"; } } }')
        configuration.chmod(0o644)
        docker('create', '--name', f'{self.name}-proxy', '--label', LABEL,
               '--network', 'bridge', '-p', f'127.0.0.1:{port}:80',
               '--mount', f'type=bind,src={configuration},dst=/etc/nginx/nginx.conf,readonly', image)
        docker('network', 'connect', self.name, f'{self.name}-proxy')
        docker('start', f'{self.name}-proxy')

    def command(self, *arguments):
        return self.app('dist/command/command.js', *arguments)

    def logs(self):
        for service in ['db', 'redis', 'api', 'worker', 'proxy']:
            result = docker('logs', f'{self.name}-{service}', check=False)
            (self.directory / f'{service}.log').write_bytes(result.stdout + result.stderr)

    def close(self):
        cleanup(self.name)


def cleanup(name):
    if not re.fullmatch(r'twenty-migration-[0-9a-f]{12}', name):
        raise RuntimeError('Environment guard: invalid rehearsal resource name')
    # Inspect labels as well as names before removing any container or volume.
    for service in ['proxy', 'api', 'worker', 'db', 'redis']:
        container = f'{name}-{service}'
        result = docker('inspect', container, check=False)
        if result.returncode:
            continue
        metadata = json.loads(result.stdout)[0]
        if LABEL not in metadata['Config'].get('Labels', {}):
            raise RuntimeError('Environment guard: container is not owned by migration-test')
        docker('rm', '-fv', container)
    result = docker('network', 'inspect', name, check=False)
    if result.returncode == 0:
        if LABEL not in json.loads(result.stdout)[0].get('Labels', {}):
            raise RuntimeError('Environment guard: network is not owned by migration-test')
        docker('network', 'rm', name)
