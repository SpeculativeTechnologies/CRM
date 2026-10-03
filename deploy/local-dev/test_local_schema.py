import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]


class LocalSchemaTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        (self.directory / "deploy").mkdir()
        (self.directory / "node_modules").mkdir()
        (self.directory / "packages/twenty-server").mkdir(parents=True)
        shutil.copyfile(ROOT / "deploy/local-schema.sh", self.directory / "deploy/local-schema.sh")
        self.server_env = self.directory / "packages/twenty-server/.env"
        self.server_env.write_text("PG_DATABASE_URL=postgres://postgres:postgres@localhost:5432/default\n"
                                   "REDIS_URL=redis://localhost:6379\n")
        self.events = self.directory / "events"
        self.environment = {**os.environ, "PATH": str(self.directory) + ":" + os.environ["PATH"],
                            "EVENTS": str(self.events)}
        self.executable("docker", '''#!/bin/bash
case "$*" in
  *"ps --quiet"*) echo local-test-container ;;
  "inspect "*) echo true ;;
  *"redis-cli ping"*) echo PONG ;;
esac
''')
        self.executable("npx", '''#!/bin/bash
echo "$*" >> "$EVENTS"
if [[ "$*" == *" -- upgrade" ]]; then exit "${FAIL_UPGRADE:-0}"; fi
if [[ "$*" == *"upgrade:status"* ]]; then
  echo "Instance: Up to date"
  echo "Workspaces: 1 up to date, 0 behind, 0 failed"
fi
''')

    def executable(self, name, content):
        path = self.directory / name
        path.write_text(content)
        path.chmod(0o755)

    def run_sync(self, **environment):
        return subprocess.run(["bash", str(self.directory / "deploy/local-schema.sh"), "sync"],
                              env={**self.environment, **environment}, text=True, capture_output=True, timeout=5)

    def test_sync_interleaves_upgrades_before_cache_invalidation_and_status(self):
        result = self.run_sync()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.events.read_text().splitlines(), [
            "nx run twenty-server:command -- upgrade",
            "nx run twenty-server:command -- cache:flat-cache-invalidate --all-metadata",
            "nx run twenty-server:command -- upgrade:status --failed-only",
        ])

    def test_failed_upgrade_stops_before_cache_invalidation_or_success_status(self):
        result = self.run_sync(FAIL_UPGRADE="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.events.read_text().splitlines(), ["nx run twenty-server:command -- upgrade"])

    def test_nonlocal_database_is_refused_before_any_command(self):
        self.server_env.write_text("PG_DATABASE_URL=postgres://invalid.example/default\nREDIS_URL=redis://localhost:6379\n")
        result = self.run_sync()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("standard localhost development database", result.stderr)
        self.assertFalse(self.events.exists())


if __name__ == "__main__":
    unittest.main()
