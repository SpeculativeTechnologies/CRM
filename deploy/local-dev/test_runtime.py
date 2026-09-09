import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from runtime import (OWNER, ROOT, LocalStack, Processes, available, clean_environment,
                     require_development_dataset)


class LocalDevelopmentTest(unittest.TestCase):
    def test_local_edits_require_owned_state_opt_in(self):
        stack = LocalStack('/unused', {'name': 'twenty-migration-0123456789ab'})
        state = {'api_port': 3200, 'front_port': 3201, 'app_secret': 'local-test-only', 'kind': 'mirror'}
        with patch.object(stack, 'port', return_value=12345), patch.dict(os.environ, {
                'IS_LOCAL_FIRST_WRITES_ENABLED': 'true',
                'REACT_APP_IS_LOCAL_FIRST_WRITES_ENABLED': 'true'}):
            environment = stack.host_environment(state)
            self.assertNotIn('IS_LOCAL_FIRST_WRITES_ENABLED', environment)
            environment = stack.host_environment(dict(state, local_first=True))
            self.assertEqual(environment['IS_LOCAL_FIRST_WRITES_ENABLED'], 'true')
            self.assertEqual(environment['REACT_APP_IS_LOCAL_FIRST_WRITES_ENABLED'], 'true')
            self.assertNotIn('ELECTRIC_URL', environment)

    def test_development_requires_a_mirror_unless_fixture_is_explicit(self):
        require_development_dataset({'kind': 'mirror'}, False)
        require_development_dataset({'kind': 'fixture'}, True)
        with self.assertRaisesRegex(RuntimeError, 'requires a verified CRM mirror'):
            require_development_dataset({'kind': 'fixture'}, False)

    def test_shell_credentials_and_runtime_overrides_are_not_inherited(self):
        with patch.dict(os.environ, {'PG_DATABASE_URL': 'postgres://remote.invalid/crm',
                                     'AWS_SECRET_ACCESS_KEY': 'must-not-inherit',
                                     'NODE_OPTIONS': '--require=unsafe.js',
                                     'NO_COLOR': '1', 'FORCE_COLOR': '0',
                                     'SSL_KEY_PATH': '/private/key',
                                     'VITE_PROXY_API_TO': 'https://remote.invalid'}):
            environment = clean_environment()
        for key in ['PG_DATABASE_URL', 'AWS_SECRET_ACCESS_KEY', 'SSL_KEY_PATH', 'VITE_PROXY_API_TO',
                    'NO_COLOR', 'FORCE_COLOR']:
            self.assertNotIn(key, environment)
        self.assertNotIn('unsafe.js', environment['NODE_OPTIONS'])
        self.assertEqual(environment['TWENTY_DISABLE_DOTENV'], 'true')
        self.assertEqual(environment['NX_LOAD_DOT_ENV_FILES'], 'false')

    def test_in_use_port_is_refused_before_startup(self):
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            with self.assertRaisesRegex(RuntimeError, 'in use'):
                available(listener.getsockname()[1])

    def test_cleanup_refuses_other_worktree_before_removing_anything(self):
        stack = LocalStack('/unused', {'name': 'twenty-migration-0123456789ab'})
        own = {'Config': {'Labels': {OWNER: str(ROOT)}},
               'NetworkSettings': {'Networks': {stack.name: {}}}}
        other = {'Config': {'Labels': {OWNER: '/another/worktree'}}}
        results = [subprocess.CompletedProcess([], 0, json.dumps([item]).encode(), b'')
                   for item in [own, other]]
        with patch('runtime.docker', side_effect=results) as docker, patch('runtime.cleanup') as cleanup:
            with self.assertRaisesRegex(RuntimeError, 'another worktree'):
                stack.close()
            cleanup.assert_not_called()
            self.assertTrue(all(call.args[0] == 'inspect' for call in docker.call_args_list))

    def test_non_loopback_database_port_is_refused(self):
        stack = LocalStack('/unused', {'name': 'twenty-migration-0123456789ab'})
        details = {'HostConfig': {'PortBindings': {'5432/tcp': [{'HostIp': '0.0.0.0'}]}}}
        result = subprocess.CompletedProcess([], 0, json.dumps([details]).encode(), b'')
        with patch('runtime.docker', return_value=result):
            with self.assertRaisesRegex(RuntimeError, 'only on loopback'):
                stack.port('db', 5432)

    def test_invalid_resource_name_never_reaches_docker(self):
        stack = LocalStack('/unused', {'name': 'twenty-dev'})
        with patch('runtime.docker') as docker:
            with self.assertRaisesRegex(RuntimeError, 'invalid'):
                stack.close()
            docker.assert_not_called()

    def test_stopping_watchers_leaves_unrelated_process_running(self):
        with tempfile.TemporaryDirectory() as directory:
            unrelated = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])
            processes = Processes(Path(directory), clean_environment())
            try:
                processes.start('test', [sys.executable, '-c', 'import time; time.sleep(60)'], directory)
                child = processes.children[0][1]
                processes.close()
                self.assertIsNotNone(child.poll())
                self.assertIsNone(unrelated.poll())
            finally:
                unrelated.terminate()
                unrelated.wait()


if __name__ == '__main__':
    unittest.main()
