import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "deploy/sync-upstream.sh"
WORKFLOW = ROOT / ".github/workflows/sync-upstream.yaml"
BRANCH = "sync/upstream-test"
GRAPHQL = "packages/twenty-front/src/generated/graphql.ts"


class SyncUpstreamTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="sync-upstream-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.repository = self.root / "repository"
        self.repository.mkdir()
        self.state = self.root / "state"
        self.state.mkdir()
        self.output = self.root / "outputs"
        self.shell_environment = self.root / "shell-environment"
        # Only remote calls are mocked; merges, commits, bundles and recovery use Git.
        self.shell_environment.write_text("""
git() {
  if [ "$1" = fetch ]; then return 0; fi
  if [[ " $* " == *" push "* ]]; then
    echo 'refusing workflow update without `workflow` scope' >&2
    return 1
  fi
  if [ "$1" = bundle ] && [ "${FAIL_BUNDLE:-false}" = true ]; then return 1; fi
  command git "$@"
}
osascript() { return 0; }
gh() {
  case "$1 $2" in
    'api repos/SpeculativeTechnologies/CRM') echo true ;;
    'pr list') echo 0 ;;
    *) echo 'Unexpected GitHub request in isolated test' >&2; return 1 ;;
  esac
}
""")
        self.environment = {
            **os.environ,
            "GITHUB_ACTIONS": "true",
            "SYNC_UPSTREAM_STATE_DIR": str(self.state),
            "SYNC_UPSTREAM_REGENERATE": "false",
            "GITHUB_OUTPUT": str(self.output),
            "BASH_ENV": str(self.shell_environment),
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_TERMINAL_PROMPT": "0",
        }
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.name", "Sync test")
        self.git("config", "user.email", "sync-test@example.invalid")
        self.git("remote", "add", "upstream", str(self.repository))
        (self.repository / "deploy").mkdir()
        shutil.copyfile(SCRIPT, self.repository / "deploy/sync-upstream.sh")

    def command(self, arguments, expected=0):
        result = subprocess.run(
            arguments,
            cwd=self.repository,
            env=self.environment,
            text=True,
            capture_output=True,
            timeout=30,
        )
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return result

    def git(self, *arguments, expected=0):
        return self.command(["git", *arguments], expected)

    def script(self, *arguments, expected=0):
        return self.command(["bash", "deploy/sync-upstream.sh", *arguments], expected)

    def write(self, filename, contents):
        path = self.repository / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(contents)

    def commit(self, message):
        self.git("add", "-A")
        self.git("commit", "-qm", message)

    def history(self, files=("source.ts",)):
        for filename in files:
            self.write(filename, "base\n")
        self.commit("base")
        self.git("switch", "-qc", "upstream-main")
        for filename in files:
            self.write(filename, "upstream\n")
        self.commit("upstream")
        self.git("update-ref", "refs/remotes/upstream/main", "HEAD")
        self.git("switch", "-q", "main")
        for filename in files:
            self.write(filename, "fork\n")
        self.commit("fork")
        self.git("update-ref", "refs/remotes/origin/main", "HEAD")

    def open_merge(self):
        self.history()
        self.git("switch", "-qc", BRANCH)
        self.git("merge", "--no-edit", "upstream/main", expected=1)
        (self.state / "branch").write_text(BRANCH)
        (self.state / "behind").write_text("1")

    def verify_bundle(self, markers):
        bundle = str(self.state / "sync-upstream.bundle")
        self.git("bundle", "verify", bundle)
        self.git("fetch", bundle, f"{BRANCH}:recovered")
        parents = self.git("show", "-s", "--format=%P", "recovered").stdout.split()
        self.assertEqual(len(parents), 2)
        recovered = self.git("show", "recovered:source.ts").stdout
        self.assertEqual("<<<<<<<" in recovered, markers)
        self.assertIn("bundle=true", self.output.read_text())

    def test_preserves_unfinished_merge_and_can_recover_it(self):
        self.open_merge()
        self.script("save-partial")
        self.verify_bundle(markers=True)
        self.assertIn("source.ts", (self.state / "remaining-conflicts.txt").read_text())

    def test_preserves_staged_markers_after_finalization_refuses_them(self):
        self.open_merge()
        self.git("add", "source.ts")
        self.assertEqual(self.git("diff", "--name-only", "--diff-filter=U").stdout, "")
        self.script("finish", "agent", expected=2)
        self.script("save-partial")
        self.verify_bundle(markers=True)

    def test_preserves_already_committed_resolution(self):
        self.open_merge()
        self.write("source.ts", "resolved\n")
        self.commit("resolved")
        original = self.git("rev-parse", "HEAD").stdout
        self.script("save-partial")
        self.verify_bundle(markers=False)
        self.assertEqual(self.git("rev-parse", "HEAD").stdout, original)

    def test_preserves_resolution_when_push_token_lacks_workflow_scope(self):
        self.open_merge()
        self.write("source.ts", "resolved\n")
        self.git("add", "source.ts")
        result = self.script("finish", "agent", expected=1)
        self.assertIn("Workflows read/write", result.stdout)
        self.verify_bundle(markers=False)
        self.assertIn("without `workflow` scope", (self.state / "push.log").read_text())

    def test_bundle_failure_cannot_report_success(self):
        self.open_merge()
        self.environment["FAIL_BUNDLE"] = "true"
        result = self.script("save-partial", expected=1)
        self.assertIn("FAIL: could not bundle", result.stdout)
        self.assertNotIn("bundle=true", self.output.read_text() if self.output.exists() else "")
        self.assertNotIn("partial=true", result.stdout)

    def test_requests_graphql_server_when_real_conflicts_also_need_agent(self):
        self.history(("source.ts", GRAPHQL))
        self.script("run")
        outputs = self.output.read_text()
        self.assertIn("outcome=conflict", outputs)
        self.assertIn("regenerate_graphql=true", outputs)
        self.assertIn("source.ts", self.git("diff", "--name-only", "--diff-filter=U").stdout)
        self.assertEqual((self.repository / GRAPHQL).read_text(), "upstream\n")

    def test_skips_graphql_server_without_a_graphql_conflict(self):
        self.history()
        self.script("run")
        self.assertIn("outcome=conflict", self.output.read_text())
        self.assertIn("regenerate_graphql=false", self.output.read_text())

    def test_requests_graphql_server_for_mechanical_only_merge(self):
        self.history((GRAPHQL,))
        self.script("run")
        self.assertIn("outcome=mechanical", self.output.read_text())
        self.assertIn("regenerate_graphql=true", self.output.read_text())

    def test_skips_graphql_server_for_clean_merge(self):
        self.history()
        self.git("reset", "--hard", "HEAD~1")
        self.git("update-ref", "refs/remotes/origin/main", "HEAD")
        self.script("run")
        self.assertIn("outcome=clean", self.output.read_text())
        self.assertIn("regenerate_graphql=false", self.output.read_text())

    def test_workflow_recovers_failed_agent_finalization_only(self):
        step = WORKFLOW.read_text().split("- name: Save an unfinished agent resolution", 1)[1]
        condition = re.search(r"^\s+if: (.+)$", step, re.MULTILINE).group(1)
        cases = [
            ("conflict", "success", "failure", "", True),
            ("conflict", "failure", "skipped", "", True),
            ("conflict", "success", "success", "", False),
            ("conflict", "success", "failure", "true", False),
            ("conflict", "skipped", "skipped", "", False),
            ("clean", "skipped", "failure", "", False),
        ]
        for outcome, agent, finish, bundle, expected in cases:
            with self.subTest(outcome=outcome, agent=agent, finish=finish, bundle=bundle):
                values = {
                    "steps.merge.outputs.outcome": outcome,
                    "steps.agent.outcome": agent,
                    "steps.finish.outcome": finish,
                    "steps.finish.outputs.bundle": bundle,
                }
                expression = condition.replace("always() && ", "")
                for key, value in values.items():
                    expression = expression.replace(key, f"'{value}'")
                result = subprocess.run(["bash", "-c", f"[[ {expression} ]]"], check=False)
                self.assertEqual(result.returncode == 0, expected)


if __name__ == "__main__":
    unittest.main()
