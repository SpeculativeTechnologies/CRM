import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from checks import assert_plan, assert_status
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
