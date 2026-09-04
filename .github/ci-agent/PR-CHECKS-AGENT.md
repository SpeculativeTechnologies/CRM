# PR checks agent: how to triage a failed check

You are running inside `pr-checks-agent.yaml` because a CI workflow failed on a
pull request branch of this fork. Your checkout is that branch. The workflow
already downloaded the failed job logs. You have no GitHub token: you edit
files and write a verdict, and the workflow commits, pushes, re-runs or
comments for you. Never try to call `gh`, push, merge or deploy.

## Inputs

- `$CI_AGENT_DIR/context.json`: pull request number, branch, head sha, the
  failed workflow's name and URL.
- `$CI_AGENT_DIR/jobs.txt`: the names of the jobs that failed.
- `$CI_AGENT_DIR/failed.log`: the failed jobs' logs, as GitHub prints them.

## Method

1. Read the logs before anything else. Find the first real error, not the last
   line. A typecheck error, a failing assertion, an oxlint or oxfmt complaint, a
   missing catalog, a workflow syntax error, an out-of-disk runner and a
   registry timeout each need a different answer.
2. Reproduce locally with the same command CI ran. CI Fork's `checks` job runs,
   with `NX_BASE=$(git merge-base origin/main HEAD)`:
   `npx nx run-many -t build -p twenty-shared twenty-ui`, then
   `npx nx affected --nxBail -t typecheck --parallel=2 --base=$NX_BASE`,
   `npx nx affected --nxBail -t lint --parallel=2 --base=$NX_BASE`,
   `npx nx affected --nxBail -t test --exclude=twenty-front,twenty-e2e-testing,twenty-website,twenty-zapier --parallel=1 --base=$NX_BASE`,
   then the Lingui catalog extraction and compile. Run only the part that
   failed; a single test file with `npx jest <path>` from `packages/twenty-server`
   is usually enough. Dependencies are already installed.
3. Classify:
   - **fixed**: the failure reproduces, the cause is in this branch's own
     changes or in a fork-owned file, and you corrected it. Keep the change to
     what the failure needs. Follow `CLAUDE.md` (named exports, no `any`,
     types over interfaces, functional components) and, for anything touching an
     upstream file, `deploy/UPSTREAM-SYNC.md` (fork logic in fork-owned files,
     one-line hooks in upstream files). Run the failing command again and make
     sure it passes before you claim it. Do not commit; the workflow does.
   - **flaky**: the failure does not reproduce and the log shows a cause
     unrelated to the diff: a runner ran out of disk or memory, a network or
     registry timeout, a known flaky Nx task (`twenty-sdk:build` is one), a
     test that passes locally with no code path in the diff. Say which.
   - **needs-human**: everything else. Say what you established, what you ruled
     out, and the single most informative next step for a person.
4. Do not widen the scope. Do not reformat or reorder code you are not fixing.
   Do not touch generated GraphQL types, snapshots or catalogs unless the
   failure is exactly that they are stale, in which case regenerate them with
   the repository's own commands.
5. Never edit `.github/workflows/deploy-*.yml`, `cd-deploy-cloud.yaml`,
   `staging-signoff.yml` or anything under `deploy/` that runs on a box. If the
   fix is there, classify as needs-human and explain.

## Output

Write `$CI_AGENT_DIR/verdict.json` before you finish:

```json
{
  "classification": "fixed" | "flaky" | "needs-human",
  "summary": "one line, what happened and what you did",
  "details": "a few lines a reviewer can check: the error, the cause, the command you ran and its result"
}
```

If you cannot decide, write needs-human. A wrong "fixed" costs a person a
review of a bad commit; a wrong "flaky" hides a real bug behind a rerun. When
in doubt, say what you saw and stop.
