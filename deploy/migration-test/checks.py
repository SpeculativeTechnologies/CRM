"""Checks shared by source and release-image rehearsals. No CRM rows are printed."""
import json
import re
import time
import urllib.error
import urllib.request

from stack import docker, wait_for


def assert_status(output):
    plain = re.sub(r'\x1b\[[0-9;]*m', '', output)
    if not re.search(r'Instance:\s+Up to date', plain):
        raise RuntimeError('Instance upgrades are not up to date')
    if not re.search(r'Workspaces:.*0 behind,.*0 failed', plain):
        raise RuntimeError('Workspace upgrades are missing, behind, or failed')


def assert_plan(output):
    if re.search(r'event=(?:instance\.|workspace\.catch-up |workspace\.step\.)|\[DRY RUN\]|Would run', output):
        raise RuntimeError('Upgrade dry run still plans commands')
    if not re.search(r'Upgrade summary:.*\b0 workspace\(s\) failed', output):
        raise RuntimeError('Upgrade dry run did not report success')


def drain_queues(stack, timeout):
    # Fresh Redis has no historical failures or scheduled cron jobs. Wait for
    # delayed backfills too; a health endpoint alone cannot establish completion.
    script = '''local pending = 0
    for _, key in ipairs(redis.call('keys', '*')) do
      local suffix = string.match(key, ':([^:]+)$')
      if suffix == 'wait' or suffix == 'active' or suffix == 'paused' then
        pending = pending + redis.call('llen', key)
      elseif suffix == 'delayed' or suffix == 'prioritized' or suffix == 'waiting-children' then
        pending = pending + redis.call('zcard', key)
      elseif suffix == 'failed' and redis.call('zcard', key) > 0 then
        return -1
      end
    end
    return pending'''
    stable = 0
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = docker('exec', f'{stack.name}-redis', 'redis-cli', '--raw', 'EVAL', script, '0')
        count = int(result.stdout)
        if count < 0:
            raise RuntimeError('Background migration/job failed; inspect worker diagnostics')
        stable = stable + 1 if count == 0 else 0
        if stable >= 3:
            return
        time.sleep(2)
    raise RuntimeError('Background work did not drain before timeout')


def request(url, query=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    data = json.dumps({'query': query}).encode() if query else None
    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=30) as response:
        body = response.read().decode()
    if not query:
        return body
    result = json.loads(body)
    if result.get('errors') or not result.get('data'):
        raise RuntimeError('API smoke query failed (response withheld to protect CRM data)')
    return result['data']


def smoke(stack, preview, fixture):
    port = docker('port', f'{stack.name}-proxy', '80/tcp').stdout.decode().strip().split(':')[-1]
    url = f'http://127.0.0.1:{port}'
    def healthy():
        try:
            request(url + '/healthz')
            return True
        except (OSError, urllib.error.URLError):
            return False
    wait_for(healthy, 180)
    workspace = stack.sql('SELECT id FROM core.workspace WHERE "activationStatus" = \'ACTIVE\' ORDER BY id LIMIT 1;')
    if not re.fullmatch(r'[0-9a-f-]{36}', workspace):
        raise RuntimeError('Baseline must contain an active workspace')
    output = stack.command('workspace:generate-api-key', '-w', workspace, '-n', 'migration-rehearsal', '-e', '1')
    token_match = re.search(r'TOKEN:([A-Za-z0-9._-]+)', output.stdout.decode())
    if output.returncode or not token_match:
        raise RuntimeError('Could not mint local smoke token')
    token = token_match[1]
    for endpoint, query, collection in [
        ('graphql', '{ companies { edges { node { id } } } }', 'companies'),
        ('graphql', '{ people { edges { node { id } } } }', 'people'),
        ('metadata', '{ objects { edges { node { id nameSingular } } } }', 'objects'),
    ]:
        data = request(f'{url}/{endpoint}', query, token)
        if not data[collection]['edges']:
            raise RuntimeError(f'Expected pre-existing {collection}')
    # Verify authentication remains required. HTTP 200 GraphQL errors are valid.
    try:
        request(url + '/graphql', '{ companies { edges { node { id } } } }')
    except (urllib.error.HTTPError, RuntimeError):
        pass
    else:
        raise RuntimeError('Unauthenticated query unexpectedly succeeded')
    if fixture:
        result = request(url + '/graphql', 'mutation { createCompany(data: {name: "Migration rehearsal persistence"}) { id } }', token)
        identifier = result['createCompany']['id']
        query = '{ company(filter: {id: {eq: "' + identifier + '"}}) { id name } }'
        if request(url + '/graphql', query, token)['company']['name'] != 'Migration rehearsal persistence':
            raise RuntimeError('Created fixture record did not persist across requests')
    if preview:
        html = request(url + '/')
        if 'twenty-env-config' not in html or stack.environment['SERVER_URL'] not in html:
            raise RuntimeError('Release frontend did not receive runtime SERVER_URL')
        if stack.environment['ENVIRONMENT_LABEL'] not in html:
            raise RuntimeError('Release frontend did not receive runtime environment label')
    print(f'[migration-test] API, metadata, persistence and authentication checked; preview {url}', flush=True)
    return url
