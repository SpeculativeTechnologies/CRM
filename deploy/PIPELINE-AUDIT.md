# Development pipeline audit, 2026-09-05

Audited `db7df026e3efeb7984e0fc3defa0988dcea6bbd1`, Twenty 2.38, Nx 22.7.8,
Yarn 4.13, Node 24, PostgreSQL 16 and Redis 7. Deployment topology was checked
against the private `crm-ops/deploy/CLOUD-OPS.md` and live workflow logs: Google
Cloud VMs running Compose behind Cloudflare, not Cloud Run. Private operational
details remain in that repository.

## Actual dependency graph

Before this change: local checks -> feature PR -> CI Fork/release-risk checks ->
review/merge -> main CI plus image build in parallel -> manually selected SHA ->
staging rehearsal/deploy/verification -> human staging check -> production
approval/deploy. `needs-staging` PRs may build before merge. No push deploys an
environment. A separate PR failure agent diagnoses supported CI failures.

CI Fork serializes shared builds, affected typecheck, lint, unit tests and catalog
checks; frontend shards run on separate runners. Main's base was its own HEAD,
so its affected checks were empty. It still started three empty frontend shards.
Images already shared dependency layers and registry BuildKit caches; the cloud
boxes pulled SHA tags and did not rebuild. A tag is mutable, however, and ordinary
production promotion accepted a descendant of staging's commit. Database
containment checks were stronger, but did not bind evidence to an image digest
or deployment revision. A later failed signoff left an earlier pass standing.

After this change: main validates its actual previous-push-to-merge range; PRs
validate the synthetic merge against the PR base. An independent migration job
restores a declared baseline each time and joins `ci-fork-status-check`. Release
builds certify their actual digest only after a fresh baseline/API/worker test.
A previously certified SHA reuses its image. Staging and production consume that
same digest; the latest staging deployment and human check must agree on source,
digest and deployment ID. A pending or failed deployment/check blocks promotion.
Production retains its environment approval. No cloud action is performed by
this implementation task.

## Measurements and prioritization

Source: GitHub job timestamps and downloaded logs, not estimates. Wall totals
include queue gaps between jobs; phase durations below are runner step times.

| Run | Total | Relevant phases and cache evidence |
|---|---:|---|
| [PR CI #33987989159](https://github.com/SpeculativeTechnologies/CRM/actions/runs/33987989159) | 9m40s | Checkout 105s; dependency setup 132s; shared build 55s; typecheck 54s; lint 29s; unit tests 159s; catalogs 29s. Dependency cache hit; task cache miss on new PR. |
| [Main CI #33988555617](https://github.com/SpeculativeTechnologies/CRM/actions/runs/33988555617) | 4m22s | Checks runner 221s; three empty front shards 138–244s. Dependency/task cache hits; affected validation empty. |
| [PR image #33987989459](https://github.com/SpeculativeTechnologies/CRM/actions/runs/33987989459) | 4m56s | Build/push 231s; dependency layers cached, changed server source rebuilt. |
| [Main image #33988555621](https://github.com/SpeculativeTechnologies/CRM/actions/runs/33988555621) | 1m20s | Build/push 14s, manifest 2s; fully warm BuildKit. |
| [Staging child #33988637390](https://github.com/SpeculativeTechnologies/CRM/actions/runs/33988637390) | 3m50s | Checkout 11s; cloud tooling 18s; rehearsal including pull 33s; deploy including migrations/startup 111s; verification 45s. |

The corresponding staging wrapper took 4m21s. Existing cloud logs do not provide
independent timers for pull, migration, startup, or individual health probes;
those phases cannot honestly be split further. No comparable completely cold
image/dependency run was available in this sample. Queue/coordination overhead
was about 9s for the PR CI (580s total vs 571s checks), 6s for staging's child
(230s vs 226s runner), and 31s for its wrapper beyond the child.

Priority by evidence and implementation cost:

1. Correct the empty main validation and exact-artifact gates: small workflow
   changes, correctness requirement. These add real validation time.
2. Run migration rehearsals before merge: larger change, directly targets the
   observed production-data failures. Independent runner preserves parallelism.
3. Let new PR task caches fall back to main; include OS/architecture, manifests,
   patches and Yarn config in dependency keys. Main previously had warm caches
   new PRs could not restore. Shared compiler/tooling inputs now invalidate Nx
   tasks; database commands explicitly cannot cache their results.
4. Preserve working registry BuildKit caches and existing separate dependency
   stages. Exclude local builds/dumps from Docker context. Do not pay for larger
   runners or another platform without evidence. Splitting every 54s typecheck
   onto another runner would add roughly 132s dependency setup in this sample.

No before/after cloud speed improvement is claimed. The new CI and release
artifact gates have to run on comparable commits to measure their net effect.
Local rehearsal measurements and verification limitations are recorded in the
PR; the harness retains per-phase timings for subsequent comparisons.

## Migration and failure findings

The fork uses legacy TypeORM migrations plus registered fast/slow instance
commands and workspace commands. `upgradeMigration` retains per-command attempts
and workspace cursors. `upgrade` catches missed commands behind cursors from the
fork's supported floor, then runs the normal sequence. Commands below the floor
are intentionally skipped. Commands for future versions remain dormant.
Replaying committed migration bodies or manually patching schema is unsupported.

[Failed deployment #33876973063](https://github.com/SpeculativeTechnologies/CRM/actions/runs/33876973063)
failed a workspace field-metadata transformation with `Query read timeout`, then
reported one failed workspace and exited 1: a migration/data-volume and timeout
configuration failure, not an image compilation problem. The private operations
change already raises the migration query timeout; this PR retains that setting.
[Production #34005833780](https://github.com/SpeculativeTechnologies/CRM/actions/runs/34005833780)
correctly refused an unsigned database promotion: a release-control failure,
not an infrastructure outage. Other resource incidents documented in the private
runbook were not independently timed in this audit.

The current host script has no cross-process deployment lock; this change adds
one in the paired private PR. API/worker entrypoint migrations remain disabled.
An image rollback cannot undo committed schema/backfill changes, so forward and
backward application compatibility must be reviewed per migration, with a
compensating migration or backup restore for database recovery.

References consulted: repository source and run logs are authoritative;
[PostgreSQL cloning](https://www.postgresql.org/docs/current/sql-createdatabase.html),
[Nx affected](https://nx.dev/docs/features/ci-features/affected), and
[BuildKit caches](https://docs.docker.com/build/ci/github-actions/cache/) describe
the underlying mechanisms. Context7 was queried for Nx Git base/head guidance.

## Local acceptance evidence

A locally built server from the audited application source initialized the full
synthetic fixture in 15.8s after setup/instance initialization. The light seeder
was found to violate a calendar-participant foreign key, swallow the error and
exit zero; freeze now rejects that failure and uses the complete synthetic seed.
No migration code was changed to accommodate it.

Frozen baseline `f40d946896325cfc4085af76abfe067a20b16beecf1561a85f023f84a3c07005`
contains two workspaces on PostgreSQL 16.15, with citext, unaccent and uuid-ossp.
A test-only registered instance command copied existing workspace IDs into a
backfill table. Its controlled exception failed the instance phase in 5.3s,
before API startup. The corrected command ran from the identical dump, backfilled
both records, and passed SQL assertions, API/metadata reads, a create/read
persistence check, authentication rejection and worker queue checks. Corrected
attempt phases totaled 86.4s; restore took 5.9s under concurrent compiler load.
The failed attempt's restore took 1.8s. These are observations, not a comparable
before/after speed claim. No template/snapshot optimization is justified yet.

The temporary demonstration lives outside the source tree and is not shipped.
No mirrored data, live staging or production was used. Local GHCR pulls were
denied even with the available GitHub login, so this is source-built local image
verification, not verification of the published release digest. The CI release
job performs that latter check. Seven existing runtime-config tests passed;
actual staging/production URL rendering remains an owner staging check.
