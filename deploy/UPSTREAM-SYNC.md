# Upstream sync

How twentyhq/twenty main gets merged into this fork every week, how conflicts
are resolved, and how to keep the fork cheap to merge. This is the policy the
sync agent follows in `.github/workflows/sync-upstream.yaml`; humans resolving
a sync by hand follow the same rules.

## How a sync runs

`Sync upstream` (GitHub Actions) runs Mondays 08:30 UTC and on demand from the
Actions tab. It:

1. merges `upstream/main` onto `sync/upstream-<date>` from `origin/main`;
2. resolves the mechanical conflicts by taking upstream: locale catalogs
   (`*.po`, `locales/generated/*.ts`), generated GraphQL types
   (`generated*/graphql.ts`) and jest snapshots;
3. if real conflicts remain, hands the open merge to Claude Code with this
   file as the policy. Without a `CLAUDE_CODE_OAUTH_TOKEN` secret it files an
   "Upstream sync conflict" issue instead;
4. regenerates: `yarn install`, Lingui extract and compile for front, server
   and emails, re-records the conflicted snapshot suites, and regenerates the
   GraphQL types against a server built from the merged code when they
   conflicted;
5. pushes, opens the PR labelled `upstream-sync`, and closes open conflict
   issues.

It never merges into `main` itself. If the repo variable
`SYNC_UPSTREAM_AUTOMERGE` is `true`, a PR whose conflicts were all mechanical
is queued with `gh pr merge --auto`, so GitHub merges it when CI Fork passes.
A PR the agent resolved always waits for a human. Merging to `main` deploys
nothing: staging and production are separate manual dispatches
(`deploy/TEAM-WORKFLOW.md`).

Run by hand from any clone: `bash deploy/sync-upstream.sh`. Outside CI it
works in a throwaway worktree and still opens the PR, but does not regenerate
(set `SYNC_UPSTREAM_REGENERATE=true` to change that) and does not call the
agent.

## Resolution policy

**Keep upstream's structure. Re-apply the fork's intent.** Upstream is the
moving part; the fork's changes are the small part. Every resolution starts
from upstream's version of the file and puts the fork's behavior back.

For each conflicted file:

```bash
BASE=$(git merge-base origin/main upstream/main)
git log --format='%h %an %s' $BASE..origin/main -- <file>     # what the fork did and why
git log --format='%h %an %s' $BASE..upstream/main -- <file>   # what upstream did
git show :1:<file>   # base      :2:<file>  fork      :3:<file>  upstream
```

- **Modify/delete** (upstream deleted a file the fork changed): find where
  upstream moved the logic, port the fork's change there, delete the file.
- **Add/add** (both sides created the same path): take upstream's, adapt the
  fork's callers, extend upstream's version only for behavior it lacks.
- **Registries and barrels** (`index.ts`, module `imports:` arrays, constant
  maps): keep both sides' entries. Most of these are `merge=union` in
  `.gitattributes` and never reach a human. When upstream reformats the whole
  block, union can leave a nested duplicate (2026-09-03,
  `SidePanelPagesConfig.tsx`); typecheck catches it. Rebuild from upstream's
  file and re-add the fork's lines.
- **Never silently drop fork behavior.** If it cannot be ported cleanly, keep
  upstream's pipeline working and list the behavior under "Unported" in the
  PR so the owner decides.
- Fork-owned files that are not conflicted may still need edits when upstream
  renamed or moved what they import. Fix them; do not leave the fork code
  compiling against a structure that no longer exists.

### Recurring hotspots

Decisions that have held across syncs. When one of these files conflicts, the
answer is already known.

| Area | Fork keeps | Take from upstream |
| --- | --- | --- |
| `common-merge-many-query-runner.service.ts` | person-merge machinery (avatar/email release and soft delete as raw SQL through the transaction query runner; `WorkspaceEntityManager.query` throws) | everything structural |
| `common-extended-query-runner-context.type.ts`, base runner | `workspaceDataSource: GlobalWorkspaceDataSource` on the context for record-label-formula recomputes | the rest |
| `people-merge-many.integration-spec.ts` | the fork's version, always | nothing |
| `graphql-query-filter-*.parser*`, `turnRecordFilterIntoGqlOperationFilter.ts` | one-to-many relation filters (EXISTS subquery, `instanceof WorkspaceSelectQueryBuilder` guard) | new operands and refactors |
| `SettingsNavigationDrawer.tsx` | hidden settings tab row | layout changes |
| `generate-front-config*` | the fork's file, a superset | nothing |
| `logic-function-executor.service.ts` | internal API URL (Cloudflare Access blocks the public one) | the rest |
| `instance-commands.constant.ts`, `workspace-command-provider.module.ts` | fork registrations (`merge=union`) | upstream registrations |
| `standard-object*.constant.ts` (twenty-shared) | fork objects and fields; universal identifiers must stay unique across both sides | upstream objects and fields |
| `modules/emailing/**` | engagement tracking (opens, clicks, replies per recipient) hooked into the delivery service; Cc lists, drafts and the mass-email path in `message-campaign-authoring.service.ts`; reply attribution; stats refresh | upstream's campaign pipeline (delivery rows, exactly-once claims, webhook outcomes, suppression) |
| `common-merge-many-query-runner.service.ts` person steps | dedup, avatar handover, email release and Trash soft delete inside the v2 transaction scope via `executeRawQuery`; batched repointing | the v2 transaction body |
| `upgrade-sequence-runner.service.ts` | catch-up of instance steps inserted behind the cursor, the start cursor that ignores their backdated record, and the hook that runs `ForkMissedWorkspaceCommandsService` before resuming | everything else |
| `apollo.factory.ts` | auth-proxy session recovery and the local-first hooks | client construction |
| `README.md`, `CLAUDE.md` | the fork's file (`merge=ours`) | nothing |
| `*.service.spec.ts` | upstream deleted them all (their #24094); fork-only behavior is tested in fork-owned spec files instead | deletions |

### What breaks that CI does not see

- **Backdated upgrade commands.** Production seeded at ~2.9, and both sides
  insert workspace commands behind positions the boxes already passed:
  upstream backdates into released versions, the fork adds fixes in front of
  an upstream command that failed on staging. Since 2026-09-03 `upgrade`
  catches these up itself before resuming: every workspace command between a
  workspace's earliest and furthest record whose latest attempt is not
  completed runs, in sequence order, and is recorded with a `createdAt` just
  before the cursor row so the cursor does not move. Watch the deploy log for
  `workspace.catch-up` lines. A caught-up command runs after every later
  instance command has already applied, so check the diff for a command that
  writes a shape a newer constraint forbids (the 2.35 navigation backfill
  needed a payload-clearing branch for exactly this).
- **ORM v1 is gone** (2026-09-03). Everything runs on `WorkspaceOrmManager`
  and `WorkspaceRepository`; `getRepository` no longer takes a workspaceId. A
  fork file that still imports `global-workspace-datasource` needs porting,
  not restoring.
- **Backdated instance commands.** When upstream adds instance commands to a
  version this instance already passed, `upgrade` now runs them before
  resuming (2026-09-03, the 2.35 command-menu-item column). Watch the deploy
  log for `instance.catch-up` lines and check the dev-database run in the
  sync PR did the same.
- **Stale caches after a DB restore.** Flush Redis before running commands or
  they fail with bogus "not found" errors.

## Verifying a sync PR

CI Fork covers typecheck, lint, unit tests and catalog freshness. Before
promoting, on a checkout of the branch with mirrored data
(`bash deploy/local-data.sh mirror`):

```bash
yarn install
npx nx run-many -t typecheck lint -p twenty-shared twenty-server twenty-front
cd packages/twenty-server && node dist/command/command upgrade --dry-run && node dist/command/command upgrade
cd packages/twenty-server && npx jest src/engine/api/common src/modules/emailing src/modules/messaging
```

Then exercise on staging whatever the "Agent notes" and "Regeneration"
sections of the PR call out, and record the staging check if a DB change
rides along.

## Keeping the fork mergeable

The fork currently modifies about 320 upstream-tracked source files, and each
week roughly a fifth of them collide with an upstream change. Every file the
fork touches in place is a future conflict. Rules for new fork work:

- **Fork logic lives in fork-owned files.** Add a hook, a wrapper, or one
  import line in the upstream file and put the behavior next to it in a new
  file. A one-line hunk merges; a rewritten function does not.
- **Fork tests live in fork-owned spec files** (`*-fork-*.spec.ts` or a spec
  next to the fork-owned file). Upstream deletes and restructures its specs
  freely.
- **Registries get `merge=union`.** When a new fork entry lands in an
  append-only list that upstream also appends to, add the path to
  `.gitattributes`. Duplicates and ordering are caught by typecheck and lint.
- **Do not reformat or reorder upstream code** you are not changing. Whitespace
  and import-order churn is pure conflict surface.
- **Prefer upstream's extension points** (workspace commands, apps under
  `twenty-apps/`, metadata) over patching engine files. Fork-only standard
  objects and fields belong in the fork's own metadata utils.
- **Upstream what you can.** The campaign engagement work collided with
  upstream's own campaign rewrite; had it landed upstream first, the merge
  would have been free.

`bash deploy/upstream-footprint.sh` prints the current footprint and the
directories that carry it. Watch the number; it is the leading indicator of
next week's conflict count.

## Operating the workflow

One-time setup, repo settings:

- Secret `SYNC_UPSTREAM_TOKEN`: fine-grained PAT (or GitHub App token) scoped
  to this repository with Contents, Pull requests and Issues read/write.
  `GITHUB_TOKEN` is not enough: pull requests it opens do not trigger CI Fork.
- Secret `CLAUDE_CODE_OAUTH_TOKEN` (optional): enables the agent step.
- Variable `SYNC_UPSTREAM_AUTOMERGE` (optional): `true` to auto-merge
  mechanically resolved syncs once CI is green.

Retire the old cron on the Mac deploy host so two runners do not race:
`crontab -e` and remove the `sync-upstream.sh` line.

When a run fails before opening a PR it files or comments on an "Upstream
sync conflict" issue and the workflow summary says why. An open sync PR
blocks the next run until it is merged or closed.
