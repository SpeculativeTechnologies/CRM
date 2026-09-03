# CRM team workflow

This is the authoritative workflow for changing the CRM without changing the
live instance accidentally.

New to the project? Read [SHIPPING.md](SHIPPING.md) first — it walks through the
same process in plain language. This document is the rulebook; that one is the
walkthrough.

## Environment boundaries

| Environment | Location | Data | Purpose |
|---|---|---|---|
| Development | Each developer's machine | Developer-owned Postgres, Redis, and storage | Build and test feature branches |
| Staging | Google Cloud, `crm-staging.spec.tech` | Isolated copy of production data | Validate a release candidate from `main` before production |
| Production | Google Cloud, `crm.spec.tech` | Live CRM data | The instance the team uses |

The boundaries are mandatory:

- Develop only in a clone of this repository on a developer-owned machine.
- Never point development at cloud Postgres, Redis, storage, or environment
  files.
- Never copy production secrets into development or staging.
- Never run development setup, reset, or test commands on a cloud VM.
- Operate staging and production through the GitHub workflows and the private
  `SpeculativeTechnologies/crm-ops` runbooks.
- Only code merged into `main` may be deployed to production.

See [DEVELOPMENT.md](DEVELOPMENT.md), [STAGING.md](STAGING.md), and
[PRODUCTION.md](PRODUCTION.md) for environment-specific instructions.

Application code, migrations, CI, image builds, and promotion workflows belong
in this public repository. Cloud Compose configuration, host scripts, backups,
tunnel configuration, systemd units, and operational runbooks belong in the
private [`crm-ops`](https://github.com/SpeculativeTechnologies/crm-ops)
repository. Use coordinated PRs when a change requires both.

## Starting work

1. Fetch and branch from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c yourname/short-description
   ```

2. Develop and test on the developer's own machine.
3. Push the branch and open a PR against `SpeculativeTechnologies/CRM:main`.
4. Wait for `ci-fork-status-check` and review.
5. Merge on GitHub. Do not push directly to `main`.

## Pull-request protocol

Every PR should state:

- What changed and why.
- How it was tested.
- Whether it changes the database, environment variables, deployment, user
  permissions, integrations, or background jobs.
- The rollback method.
- Screenshots for visible UI changes.

Which pull requests need the production owner's review is decided by
[CODEOWNERS](../.github/CODEOWNERS) and described in *What needs the production
owner* below. Everything outside those paths may be reviewed by any developer
with write access, or merged on the author's own judgement. Database changes
are in that second group but carry a gate of their own on the way to
production; see *Database changes* below.

Entity changes must include their generated instance command. Do not edit the
`up` or `down` of an already-merged command. Regenerate frontend GraphQL types
in the same PR as a GraphQL schema change.

## What needs the production owner

Promotion is delegated. Any developer with write access can merge to `main`,
deploy to staging, and approve and run a production deploy. That is safe for
most changes because of one property, and the exceptions are the changes that
lack it:

> **Does redeploying the previous SHA undo this?**

Deploys are pinned to a full commit SHA, the commit must already be on `main`,
and staging must have exercised it. Rollback is another deploy of a known-good
SHA. So a change whose worst case is *the application misbehaves until someone
redeploys* needs no special gate. Frontend work, styling, copy, views, and most
server logic are in this category. Ship them.

The changes that outlive a rollback are these, and they carry `@bzreinhardt` in
CODEOWNERS so that GitHub requests the review without anyone remembering to:

| Area | Why a rollback does not fix it |
|---|---|
| auth, permissions, guards | Bad state persists in issued sessions and tokens after the code is gone. |
| messaging, calendar | Reaches real mailboxes and calendars, and staging is sanitized so it cannot rehearse either. |
| `deploy/**`, `twenty-config/**`, promotion workflows | Configuration lives outside the pinned image, so rolling the image back leaves it in place. |
| Anything paired with a `crm-ops` change | Same reason: the other half of the change is not in this repository. |

Messaging and calendar are worth spelling out, because the obvious next move is
wrong. Staging cannot rehearse them at all: `deploy/staging-sanitize.sql`
disables message and calendar sync and nulls every connected account's tokens
on each restore, so the outbound path resolves no account and never runs. That
is deliberate, and undoing it would be worse, because staging holds mirrored
production contact data. A live mailbox connection there means a messaging bug
mails real people.

So a recorded staging check for a messaging change would certify a code path
that never executed, which is worse than no gate because it looks like one.
Database changes could move to a promotion gate because staging genuinely runs
them. These cannot until there is somewhere to run them: a throwaway account,
with the mirrored contact addresses scrubbed or redirected.

`.github/workflows/ci-fork-release-risk.yaml` labels each pull request against
these tables and fails when an irreversible change arrives undocumented. It
enforces two things a reviewer would otherwise have to catch by eye:

- A command whose `up` path drops schema or writes data must have a `##
  Rollback` section in the pull-request description. "Redeploy the previous
  SHA" is not a rollback for a migration, so say what actually restores the
  data: a backup restore, a compensating command, or an accepted loss.
- A command registered under a `TWENTY_NEXT_VERSIONS` version ships **inert**.
  The upgrade sequence only runs the previous and current versions, so a
  command decorated `2.36.0` while the app is on `2.35.0` is skipped by every
  deploy and has to be run by name on each box afterwards. It works in the
  author's local testing because they invoke it directly. This shipped
  unnoticed three times on 2026-08-12. The description must state the manual
  run, including its `--dry-run` step.

The check reports on every pull request, so a green run on an ordinary change
means the classifier looked and found nothing, not that it failed to run. An
upstream sync is classified and labelled but not blocked: those migrations are
Twenty's own and arrive with their version bump.

## Database changes: gated at promotion, not at merge

Database changes outlive a rollback for the same reason a migration that has
run stays run, and `down` restores schema, not deleted rows. But a review of
the diff is a poor guard against that. What actually catches a bad migration is
running it against a copy of production data and looking at the result, so
these are gated where that evidence exists rather than at merge:

| Area | What reaches the database |
|---|---|
| `packages/twenty-server/src/database/**` | Migrations and upgrade commands. |
| `engine/core-modules/upgrade/**` | Which commands run, and in what order, on every box. |
| `**/*.entity.ts`, `**/*.workspace-entity.ts` | Table definitions, synced into the schema on upgrade. |

Any developer can merge these. `ci-fork-release-risk` labels the pull request
`risk:database` and says in its report what promoting it will require.
Promotion is where the gate is:

1. Merge, then run **Deploy to staging** for the merged SHA.
2. Exercise the change on staging against the mirrored data, not just the
   application's health check.
3. Run **Record a staging check**, describing what you exercised. It signs off
   whatever `staging-target` points at, which is only ever a commit staging
   deployed successfully, and moves `staging-verified` to it.
4. Run **Deploy to production**. It refuses the promotion unless every
   database-touching file in it is already inside the signed-off commit.

Step 4 is stricter than the general staging rule on purpose. Ordinary code only
has to have an ancestor on staging, which is fine when a redeploy undoes it. A
migration merged on top of a staged commit would otherwise ride to production
having never run anywhere, so it is held to containment in the checked commit
instead. The consequence worth knowing: merging another database change after
the check invalidates the check, and staging has to run and be checked again.

None of this constrains what someone with an interactive shell on the box can
do. The gate is on the promotion workflow, not on the machine. Server access is
a separate grant, and the controls there are the nightly backups, the audit
trail, and the runbooks in `crm-ops`.

## Promotion protocol

Promotion is forward-only:

```text
feature branch -> pull request/CI/review -> main -> staging -> production
```

Schema changes travel with the application code that requires them. Developers
must run:

```bash
bash deploy/local-schema.sh sync
```

against an existing local database and test a clean local initialization before
requesting review. Never repair drift with manual production SQL, and never
promote a schema by copying it between environments.

Copying *data* downward is supported only through the mirror pipeline: `bash
deploy/local-data.sh mirror` builds a verified scrubbed copy from the latest
available nightly production backup, installs it on a developer machine, and
brings it forward to the checked-out commit with `local-schema.sh sync`. Schema
still travels only through committed instance commands and workspace upgrades.
See [DEVELOPMENT.md](DEVELOPMENT.md) for what the mirror contains and how it
must be handled.

1. Merge each reviewed PR to `main` after its required CI checks pass. Do not
   push directly to `main`.
2. At the scheduled release window, typically at the end of the day, identify
   the exact full commit SHA on `main` to release and wait for CI to publish its
   GHCR image.
3. Run **Deploy to staging** with that exact SHA. The workflow wakes cloud
   staging, deploys the pinned image, runs migrations and health checks, and
   reports the result.
4. Exercise the changed behavior and the normal CRM smoke-test paths at
   `https://crm-staging.spec.tech`. Record an affirmative pass or fail; the
   absence of alerts alone is not a successful smoke test.
5. Run **Record a staging check** with that pass or fail and what you
   exercised. Required before a database change can be promoted, and worth
   doing either way: it is the only durable record of what step 4 actually
   covered.
6. If staging passes, run **Deploy to production** for the exact SHA staging
   ran. The workflow verifies that the commit is on `main`, that it passed
   through staging, and that anything reaching the database is inside the
   commit step 5 signed off, then waits for the production approval gate.
   Anyone on the
   `production` environment's reviewer list can approve it, including their own
   run; the gate is a deliberate pause and an audit record, not a second
   opinion. Whoever approves it watches the release. If the release window ends
   before validation is complete, promote it during the next supported window
   instead.
7. If staging fails, do not deploy to production. Revert or fix the problem in
   another reviewed PR, then deploy and test the new `main` SHA on staging.
8. Follow the private
   [`crm-ops` cloud runbook](https://github.com/SpeculativeTechnologies/crm-ops/blob/main/deploy/CLOUD-OPS.md)
   for operational checks, backups, incidents, and rollback.

Pre-merge staging is an exception for unusually risky changes that need cloud
validation before they can be reviewed safely. Add `needs-staging` to publish
an image for the unmerged PR, deploy its exact SHA, and record what was tested.
This exception does not replace CI or review. The normal release train still
deploys a selected SHA from `main` to staging before production.

Do not use `latest` to identify a staging or production release. Deploys use a
full commit SHA; rollback is another deployment of a known-good SHA.

## Upstream synchronization

Ben owns merges from `twentyhq/twenty`. The `Sync upstream` GitHub Actions
workflow opens a `sync/upstream-YYYY-MM-DD` PR every Monday (or on demand),
resolves the mechanical conflicts, hands real conflicts to the sync agent, and
regenerates catalogs, snapshots and GraphQL types. The PR then goes through
CI, review, staging, and production like any other change. With the repo
variable `SYNC_UPSTREAM_AUTOMERGE` set to `true`, a sync whose conflicts were
all mechanical merges to `main` on its own once CI Fork is green; a sync the
agent resolved always waits for Ben. Merging to `main` deploys nothing.

Resolution policy, recurring hotspots, verification steps, and the rules for
keeping new fork work mergeable are in `deploy/UPSTREAM-SYNC.md`. Do not
bypass the PR and promotion workflows.

## Emergency changes

If the normal process must be bypassed:

1. Record why and who authorized it.
2. Back up before any data or schema change.
3. Make the smallest possible change.
4. Open a follow-up PR immediately so Git remains the source of truth.
5. Record verification and rollback results.
