# Release automation: what checks a release, and what still needs a person

Written after 2026-09-03/04, when promoting one week of upstream took six
staging deploys and two production attempts. Every failure was a property of
the boxes' data that no CI check could see, and every one was found by a human
reading a log and telling the agent. This document records what now checks
those things automatically, what the checks mean when they fail, and the
gaps that remain. `deploy/TEAM-WORKFLOW.md` is the human protocol; this is the
machinery under it. Production topology and box operations live in the private
`crm-ops` repository (`deploy/CLOUD-OPS.md`).

## Topology in one paragraph

Two GCP VMs, `twenty-staging-e2` and `twenty-production-e2`, each running the
stack under Docker Compose from `/opt/twenty`, reached only over IAP, fronted by
a Cloudflare tunnel with Access in front of both the app and the API. One image
per commit on `main` (and on labeled PRs) in GHCR. A deploy is
`cloud-deploy.sh <sha>` on the box: pull, migrate in a one-off container,
restart server and worker, roll the image back on failure. The migration is
`run-instance-commands --force --include-slow` then `upgrade` then
`cache:flush`. Two workspaces exist on each box, with identical history until
1173f659.

## The invariant the upgrade tracker cannot see

Twenty records every upgrade command per workspace in `core."upgradeMigration"`
and resumes from each workspace's newest row. This fork merges upstream weekly,
so commands keep landing *behind* that row: upstream backdates into released
versions, and the fork adds a fix in front of an upstream command that failed.
Upstream's sequencer skips all of them silently.

The fork's answer (PRs #219 to #222):

- `upgrade` first runs every workspace command positioned between a workspace's
  earliest and furthest record whose latest attempt is not completed
  (`ForkMissedWorkspaceCommandsService`). Each run is recorded one millisecond
  before the cursor row so cursors never move backwards.
- Only versions from `FORK_WORKSPACE_CATCH_UP_FLOOR_VERSION` (2.35.0) are run.
  Both boxes have about 45 older gaps back to 2.10; commands that old were
  written for schemas since dropped and fail or do harm when replayed. They
  are listed once per workspace under `workspace.catch-up.skipped`. Raise the
  floor deliberately, never lower it.
- When a caught-up upstream command collides on a name, the box holds that
  entity under a pre-deterministic universal identifier. The fix is a fork
  "adopt" command registered one timestamp earlier that re-identifies the
  entity; see the two adopt commands under `2-35` and `2-38`.
- `upgrade --dry-run` executes nothing, not even instance steps, and every
  caught-up command prints its own plan. Upstream's dry run runs pending
  instance commands, which made it unsafe on a box with schema changes pending.

## What runs on every deploy

`cd-deploy-cloud.yaml` does four things, in this order, for staging and
production alike:

1. **Rehearse** (`deploy/cloud-rehearse.sh`). Pulls the target image and runs
   `upgrade --dry-run` from it against the box's real database, with a long
   query timeout. Fails on any error or failed workspace before anything
   changes. Its filtered plan is in the run's step summary: every step that
   would run, every catch-up, and the count left alone below the floor. On
   2026-09-03 this plan predicted every remaining failure once run by hand.
2. **Deploy** (`cloud-deploy.sh` on the box, from `crm-ops`).
3. **Verify** (`deploy/cloud-verify.sh`). The image is live at this point.
   Checks: the image is the requested sha (a rollback fails here), containers
   running, healthz, `upgrade --dry-run` from the deployed image plans nothing
   more, every workspace cursor is completed, no object navigation item in the
   legacy payload shape the API hides, no navigation item with neither target
   nor payload, timelineActivity search column and metadata in every
   workspace, no `ERROR` in the server log for ten minutes. Each was false on
   a box this week while healthz answered ok. A failure fails the run, so the
   promotion that caused it is refused and its summary says what to look at.
4. **Probe from outside**: 302 on the app host, 403 on the API host.

Both scripts travel with the repository and are fed to the box over IAP as
stdin, so they cannot drift from the code the way the on-box
`cloud-deploy.sh` did (it still lacked a step added to `crm-ops` on 08-24 when
this was written). Anything a script runs that might read stdin needs
`</dev/null`, or it eats the rest of the script.

## What the failures of this week would look like now

| Symptom then | Where it shows now |
| --- | --- |
| Adopt command skipped behind a failed cursor | catch-up runs it; rehearsal lists it |
| 46 ancient gaps, 2.10 command reads a dropped column | `catch-up.skipped` warning, nothing runs |
| `searchVector` name collision | rehearsal fails before deploy, names the command |
| `workflow.coreWorkflowId does not exist` | rehearsal fails before deploy |
| Search column rebuild exceeded 10 s on production | rehearsal passes (it reads); deploy needs `CLOUD_MIGRATION_QUERY_TIMEOUT_MS` in `cloud-deploy.sh`, see below |
| 92 navigation items hidden by the API | verify fails: "object navigation item(s) still carry a payload" |
| Green deploy on an invalid workflow file | CI Fork lints fork-owned workflows with actionlint |
| No staging check recorded | unchanged: Record a staging check is a human step by design |

## Gaps that remain

- **Migration query timeout.** The one-off migration container inherits the
  app's 10 s `PG_DATABASE_PRIMARY_TIMEOUT_MS`. The production search column
  rebuild took 13.8 s. `cloud-deploy.sh` must pass a long timeout to its
  `compose run`; that change lives in `crm-ops` and the script must then be
  copied to both boxes. Until then a long-running migration step fails on
  production and not on staging.
- **Workflow core links.** `2.23 AddWorkflowCoreSoftRefField` and
  `BackfillWorkflowCoreLinks` never ran on either box and sit below the floor.
  `workflowRun.coreWorkflowId` stays unset. Restoring them is a by-name job to
  review first: the backfill wipes and reinserts `core.workflow` rows with a
  2.23-era column list.
- **Parity.** Staging drifted from production twice this week (two 2.9
  commands ran there during a failed attempt; its search column was gone while
  production's was not). A nightly rehearsal of `main` against a restored
  production dump would catch production-only timing and data before anyone
  promotes. Not built.
- **PR checks.** Flaky jobs (`twenty-sdk:build`, Lingui catalogs) and real
  failures on PR branches are still noticed by people. The next piece is a
  workflow on failed check suites that downloads the failed logs, runs the
  relevant check locally, classifies flaky against real, and either pushes a
  fix to the PR branch or comments with the cause. It reuses the Claude Code
  action and token the upstream sync already uses; it never merges or deploys.

## Reading a failed run

Start at the step summary. The rehearsal block tells you what the upgrade
would do and where it stops; the verification block tells you which invariant
is false. Then the box, read-only:

```bash
gcloud compute ssh twenty-staging-e2 --zone=us-central1-a --tunnel-through-iap \
  --command 'sudo EXPECTED_SHA=<sha> bash -s' < deploy/cloud-verify.sh
gcloud compute ssh twenty-staging-e2 --zone=us-central1-a --tunnel-through-iap \
  --command 'sudo IMAGE_SHA=<sha> bash -s' < deploy/cloud-rehearse.sh
```

Neither changes the box. A migration that has to run by hand (a timeout, a
command below the floor) is the production owner's action, as
`deploy/TEAM-WORKFLOW.md` says; the twenty-gated-upgrade-command runbook has
the recipe.
