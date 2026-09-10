import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]


class RehearsalTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.events = self.directory / "events"
        self.environment = {**os.environ, "PATH": str(self.directory) + ":" + os.environ["PATH"],
                            "EVENTS": str(self.events), "IMAGE_SHA": "a" * 40,
                            "IMAGE_REF": "ghcr.io/speculativetechnologies/twenty@sha256:" + "b" * 64}
        (self.directory / ".env.cloud").touch()
        script = (ROOT / "deploy/cloud-rehearse.sh").read_text().replace("COMPOSE_DIR=/opt/twenty", "COMPOSE_DIR=" + str(self.directory))
        (self.directory / "rehearse.sh").write_text(script)
        self.executable("id", "#!/bin/sh\necho 0\n")
        self.executable("docker", '''#!/bin/bash
echo "docker $*" >> "$EVENTS"
case "$1" in
  image) echo "${REVISION:-$IMAGE_SHA}" ;;
  compose)
    if [ "${DRY_RUN_FAIL:-0}" = 1 ]; then echo "ERROR failed dry run"; exit 1; fi
    echo "DRY RUN Would run example"
    echo "Upgrade summary: 0 workspace(s) failed"
    ;;
esac
''')

    def executable(self, name, content):
        file = self.directory / name
        file.write_text(content)
        file.chmod(0o755)

    def run_rehearsal(self, locked=True, **environment):
        script = ('exec 9>"$1/.release.lock"; flock -n 9; ' if locked else '') + 'bash "$1/rehearse.sh"'
        return subprocess.run(["bash", "-c", script, "test", str(self.directory)], text=True,
                              capture_output=True, env={**self.environment, **environment}, timeout=10)

    def test_requires_host_lock_before_first_pull(self):
        result = self.run_rehearsal(locked=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("release lock required", result.stderr)
        self.assertFalse(self.events.exists())

    def test_revision_is_checked_before_database_dry_run(self):
        result = self.run_rehearsal(REVISION="c" * 40)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("revision does not match", result.stderr)
        self.assertNotIn("compose", self.events.read_text())

    def test_only_dry_run_is_executed_and_summary_is_reported(self):
        result = self.run_rehearsal()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("upgrade --dry-run", self.events.read_text())
        self.assertIn("upgrade plan for", result.stdout)

    def test_dry_run_errors_fail_the_release(self):
        result = self.run_rehearsal(DRY_RUN_FAIL="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("dry run exited with status", result.stderr)

    def test_workflow_requires_contract_then_runs_one_combined_release(self):
        workflow = (ROOT / ".github/workflows/cd-deploy-cloud.yaml").read_text()
        self.assertLess(workflow.index("RELEASE_RETENTION_CONTRACT=1"), workflow.index("--rehearse"))
        self.assertEqual(workflow.count('--command "sudo /opt/twenty/cloud-deploy.sh'), 1)
        self.assertIn('< deploy/cloud-rehearse.sh 2>&1 | tee', workflow)
        self.assertIn('STATUS=$?', workflow)
        self.assertIn('exit "$STATUS"', workflow)
        self.assertIn("cancel-in-progress: false", workflow)


if __name__ == "__main__":
    unittest.main()
