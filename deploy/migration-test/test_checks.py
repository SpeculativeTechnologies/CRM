import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from checks import assert_plan, assert_status, request, smoke
from main import validate_manifest


class MigrationGates(unittest.TestCase):
    def test_requires_explicit_success_for_instance_and_existing_workspaces(self):
        assert_status('Instance: Up to date\nWorkspaces: 1 up to date, 0 behind, 0 failed')
        for text in ['', 'Instance: Up to date\nNo workspaces',
                     'Instance: Up to date\nWorkspaces: 0 up to date, 1 behind, 0 failed',
                     'Instance: Behind\nWorkspaces: 1 up to date, 0 behind, 0 failed']:
            with self.assertRaises(RuntimeError):
                assert_status(text)

    def test_pending_commands_and_missing_upgrade_summary_fail(self):
        summary = 'Upgrade summary: 1 workspace(s) succeeded, 0 workspace(s) failed'
        assert_plan(summary)
        for text in ['', 'Upgrade summary: 1 workspace(s) failed',
                     'event=instance.dry-run\n' + summary,
                     'event=workspace.catch-up step=backfill\n' + summary]:
            with self.assertRaises(RuntimeError):
                assert_plan(text)

    def test_changed_baseline_is_refused_before_restore(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'baseline.dump').write_bytes(b'frozen database')
            (root / 'baseline.json').write_text(json.dumps(dict(format=1, kind='fixture',
                source_sha='a' * 40, dump_sha256=hashlib.sha256(b'frozen database').hexdigest())))
            validate_manifest(root)
            (root / 'baseline.dump').write_bytes(b'changed migration ledger')
            with self.assertRaises(RuntimeError):
                validate_manifest(root)


class PreviewRequests(unittest.TestCase):
    def test_document_request_explicitly_accepts_html(self):
        with patch('checks.urllib.request.urlopen') as open_url:
            open_url.return_value.__enter__.return_value.read.return_value = b'<html></html>'
            self.assertEqual(request('http://localhost/', accept='text/html'), '<html></html>')
            sent = open_url.call_args.args[0]
            self.assertEqual(sent.get_header('Accept'), 'text/html')
            self.assertEqual(sent.get_method(), 'GET')

    def test_preview_negotiates_html_and_still_requires_runtime_configuration(self):
        stack = Mock()
        stack.name = 'synthetic-smoke'
        stack.environment = {'SERVER_URL': 'http://localhost:49152', 'ENVIRONMENT_LABEL': 'test'}
        stack.sql.return_value = '00000000-0000-0000-0000-000000000001'
        stack.command.return_value = SimpleNamespace(stdout=b'TOKEN:fixture.test.token', returncode=0)

        def respond(url, query=None, token=None, *, accept=None):
            if url.endswith('/healthz'):
                return 'ok'
            if query and not token:
                raise RuntimeError('Authentication required')
            for collection in ['companies', 'people', 'objects']:
                if query and collection in query:
                    return {collection: {'edges': [{'node': {'id': 'fixture'}}]}}
            self.assertEqual(accept, 'text/html')
            return document[0]

        document = ['<html>twenty-env-config http://localhost:49152 test</html>']
        with patch('checks.docker', return_value=SimpleNamespace(stdout=b'127.0.0.1:49152')), \
             patch('checks.request', side_effect=respond):
            self.assertEqual(smoke(stack, True, False), 'http://127.0.0.1:49152')
            document[0] = '<html>missing runtime configuration</html>'
            with self.assertRaisesRegex(RuntimeError, 'runtime SERVER_URL'):
                smoke(stack, True, False)

class DiagnosticExports(unittest.TestCase):
    def test_refuses_mirror_and_redacts_fixture_tokens(self):
        import subprocess
        import sys
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            logs = root / 'logs'
            logs.mkdir()
            (logs / 'dataset.json').write_text(json.dumps({'kind': 'mirror'}))
            command = [sys.executable, str(Path(__file__).with_name('main.py')), 'report',
                       '--logs', str(logs), '--output', str(root / 'report')]
            result = subprocess.run(command, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((root / 'report').exists())
            (logs / 'dataset.json').write_text(json.dumps({'kind': 'fixture'}))
            (logs / 'test.log').write_text('TOKEN:eyJhbGciOi.TEST.SIGNATURE postgres://postgres:password@db/default')
            result = subprocess.run(command, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            report = (root / 'report/test.log').read_text()
            self.assertNotIn('eyJhbGciOi', report)
            self.assertNotIn('password', report)
