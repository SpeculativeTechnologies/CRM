from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from download import download
from manifest import validate, verify


class DownloadTests(unittest.TestCase):
    def setUp(self):
        self.data = b'PGDMPsynthetic test data'
        self.now = datetime.now(timezone.utc)
        self.manifest = dict(format=1, scrub_version=2,
                             key='snapshots/20260908T080000Z-' + 'a' * 32 + '.dump',
                             sha256=hashlib.sha256(self.data).hexdigest(), size=len(self.data),
                             source_sha='b' * 40, scrubber_sha='c' * 40,
                             source_backup_at=(self.now - timedelta(hours=1)).isoformat(),
                             built_at=self.now.isoformat())

    def test_rejects_old_source_even_when_just_rebuilt(self):
        self.manifest['source_backup_at'] = (self.now - timedelta(days=4)).isoformat()
        with self.assertRaisesRegex(ValueError, 'too old'):
            validate(self.manifest, now=self.now)

    def test_refuses_unversioned_or_external_object_paths(self):
        for key in ['latest.dump', '../raw.dump', 'https://example.com/raw.dump', 'daily/raw.dump']:
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate(dict(self.manifest, key=key))

    def test_requires_supported_scrub_and_provenance(self):
        for change in [dict(scrub_version=1), dict(source_sha='unknown'), dict(size=True),
                       dict(built_at='2026-09-08'), dict(sha256='not-a-checksum')]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate(dict(self.manifest, **change))

    def test_refuses_future_build(self):
        with self.assertRaisesRegex(ValueError, 'future'):
            validate(dict(self.manifest, built_at=(self.now + timedelta(hours=1)).isoformat()))

    def test_refuses_wrong_dump_checksum(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'test.dump'
            path.write_bytes(self.data + b'corrupt')
            with self.assertRaisesRegex(ValueError, 'checksum'):
                verify(self.manifest, path)

    def fetch(self, arguments, **kwargs):
        self.assertEqual(arguments[:2], ['rclone', 'copyto'])
        self.assertTrue(arguments[2].startswith('DEVDATA:example-mirrors/'))
        destination = Path(arguments[3])
        destination.write_bytes(json.dumps(self.manifest).encode() if arguments[2].endswith('latest.json') else self.data)
        return subprocess.CompletedProcess(arguments, 0)

    def test_download_preserves_release_metadata_and_existing_snapshot(self):
        with tempfile.TemporaryDirectory() as temporary, patch('download.subprocess.run', side_effect=self.fetch):
            output = Path(temporary) / 'saved.dump'
            download(output, 'example-mirrors')
            self.assertEqual(output.read_bytes(), self.data)
            self.assertEqual(json.loads(Path(str(output) + '.json').read_text()), self.manifest)
            with self.assertRaisesRegex(ValueError, 'already exists'):
                download(output, 'example-mirrors')

    def test_corrupt_transfer_never_becomes_available_as_saved_mirror(self):
        with tempfile.TemporaryDirectory() as temporary, patch('download.subprocess.run', side_effect=self.fetch):
            output = Path(temporary) / 'saved.dump'
            self.data += b'corrupted after publication'
            with self.assertRaises(ValueError):
                download(output, 'example-mirrors')
            self.assertEqual(list(Path(temporary).iterdir()), [])

    def test_download_failure_preserves_existing_files(self):
        with tempfile.TemporaryDirectory() as temporary, patch('download.subprocess.run') as command:
            command.return_value.returncode = 1
            existing = Path(temporary) / 'other.dump'
            existing.write_bytes(b'existing local snapshot')
            with self.assertRaisesRegex(ValueError, 'download failed'):
                download(Path(temporary) / 'new.dump', 'example-mirrors')
            self.assertEqual(existing.read_bytes(), b'existing local snapshot')
            self.assertEqual(list(Path(temporary).iterdir()), [existing])

    def test_bash_restore_check_rejects_failure_inside_if_condition(self):
        script = (Path(__file__).resolve().parents[1] / 'local-data.sh').read_text()
        function = script.split('verify_mirror() {', 1)[1].split('\nwipe_local_database()', 1)[0]
        result = subprocess.run(['bash', '-c', 'set -euo pipefail\nVERIFY_SQL=/dev/null\n'
                                 'psql_dev() { return 1; }\ninfo() { echo "$*"; }\n'
                                 'verify_mirror() {' + function + '\n'
                                 'if verify_mirror; then exit 99; fi'], capture_output=True)
        self.assertEqual(result.returncode, 0)
        self.assertNotIn(b'verification passed', result.stdout)


if __name__ == '__main__':
    unittest.main()
