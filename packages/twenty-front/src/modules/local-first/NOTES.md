# Experimental local-first CRM

This branch is a research worktree. **Do not merge or deploy it.** All gates
remain disabled by default. It now contains a durable scalar edit path and
personal tools, alongside the earlier read-replica experiment. It does not make
the entire Twenty application work offline.

## Try it locally

Use the guarded, mirror-backed worktree supervisor in [LOCAL-DEV.md](../../../../../deploy/LOCAL-DEV.md):

```bash
bash deploy/local-dev.sh start --local-first --built-front
```

This enables `IS_LOCAL_FIRST_WRITES_ENABLED` on the local API and
`REACT_APP_IS_LOCAL_FIRST_WRITES_ENABLED` in the frontend. `--built-front`
builds and serves the frontend on the workspace's usual origin. This matters
for authentication and for the service worker; another port is another origin.
Without `--built-front`, source hot reload is available but offline reopening
is not. `--no-local-first` disables the edit experiment on the next start.
Nx's build cache includes all three local-first gates.

Open an existing record and expand **Local changes**. Supported field edits
commit to browser Postgres before the existing editor reports success. Use
**Copy this record into a personal tool** to make a detached, personal working
copy of loaded, readable scalar fields. Relations, rich text and attachments
are not copied. **Open personal tools** also lets you start from an empty tool.

In the personal workspace, add fields and rows, rename/archive/restore fields,
duplicate views, choose columns, filter and sort. Definitions are interpreted
at runtime. Their stable field IDs preserve values through renames. Every save
appends a revision containing the definition and rows. Restoring history creates
a new revision. A stale browser tab must reload before it can save over a newer
revision; personal tools do not yet merge concurrent changes automatically.

Export a template to share a definition without its records. Export a tool and
history for a portable backup. Import validates the format, IDs, field types and
references, and creates a new personal tool from the exported current revision.
It does not overwrite another tool or replay the historical revisions. There is
a 10 MB import limit; large histories can currently exceed it. There is no code
evaluation or automatic publication to the shared CRM.

Opening Personal tools automatically caches the built workspace's static assets.
The status shows preparation and then confirms offline readiness. A failed
preparation offers a retry and retries when the connection returns. Wait for
the ready message on the first visit before closing the page.
`/local-workspace/` can then
open in a fresh offline tab, read saved tools and accept edits. Its service
worker only controls that path and only caches a build-generated static asset
allowlist. It never caches API responses or CRM records. Removing the offline
copy unregisters it and removes that static cache, while retaining tool data.
This opts out of automatic preparation across visits; **Enable offline access**
turns it back on. An existing ready copy opens without contacting the server.
An installed old copy can remain usable after a server flag is disabled; remove
it explicitly from that page. Updates activate when old personal tabs close.

## Record edits and reconciliation

PGlite runs in a worker with strict durability and coordinates tabs. Storage is
scoped by API origin, workspace and user. The local document and immutable
operation journal commit in one transaction. A lost HTTP response keeps the
same operation ID for retry. Fresh query results are overlaid with pending work.

The new authenticated REST endpoint also checks the captured user/workspace against
the cookie-authenticated session, preventing an old tab from sending its journal
as a newly signed-in account. It resolves stable object/field IDs, locks the
record, compares field base values, and calls Twenty's common query runners for
read/write permissions, validation and normal update behavior. It commits an
operation receipt in the same database transaction. Repeated delivery does not
mutate the record again. Only active, non-system text, number, boolean and
single-choice fields on ordinary objects are supported. Other edits retain the
existing online mutation path.

Independent field edits can merge. Conflicting scalar edits retain the local
intent and server values. Resolving a conflict folds later pending edits for
that record, preserves unrelated fields and keeps superseded intent in history.
Rejections remain visible and exportable, and may be retried with the same ID.
Queued edits sync while the main CRM's Local changes panel is mounted. The
personal workspace itself currently edits detached copies only.

Label formula reads and writes now use the caller's transaction, including
related/dependent labels. Using another connection would read stale values or
wait on the row lock held by the same request.

## Read-replica foundation

The separate existing `REACT_APP_IS_LOCAL_FIRST_ENABLED` and
`REACT_APP_IS_LOCAL_FIRST_READS_ENABLED` flags remain off, including when the
supervisor enables local edits. Electric still requires `ELECTRIC_URL` and its
authenticated shape proxy. The current proxy scopes by workspace but does not
apply object/field/row permissions to shapes. **Do not enable this replica for
general team use or widen its allowlist yet.** The edit endpoint does not use
Electric and enforces permissions through the common runners.

The replica persists schema and checkpoints, commits rows with their checkpoint,
waits for complete initial snapshots and required relations, cancels old-scope
requests, and coordinates a single sync owner. Expired shapes replace server
snapshots atomically without touching authored tables. Supported complete People
queries can return locally without racing an unnecessary network request.
Unsupported queries fall back to the ordinary API. The legacy unscoped v4
browser database is left untouched; it cannot be attributed safely to a user.

## Verification and remaining work

Focused Jest wrappers run real PGlite/NodeFS behavior scenarios in native Node
subprocesses, avoiding Jest VM restrictions on Emscripten. They cover reopening,
atomic rollback, retry IDs, conflicts, stale tabs, schema/checkpoint replacement,
personal history, validated imports and view interpretation. Server tests cover
receipts, permission-runner use and transaction-aware labels. Browser acceptance
uses the isolated mirror; public screenshots use synthetic data only.

Use explicit `--runTestsByPath` paths: a broad `local-first` pattern matches the
worktree's path and can accidentally select the entire suite. Run
`yarn check:local --parallel 1` for both packages' lint and typechecks.

Before this can become a general local-first CRM, it still needs:

- Offline startup and complete record/detail reads in the main CRM, beyond the
  separate personal workspace. Creating/deleting records, relations, bulk edits,
  rich text and actions remain online.
- Permission-aware, metadata-driven replication; permission revocation and local
  data removal semantics. Local account scoping is not encryption against someone
  with access to the browser profile. Clearing site storage removes local work.
- Cross-device replication of personal tools, collaborative text CRDTs, an explicit
  reviewed publication/migration flow, and reactive cross-tab record updates.
- A transactional server outbox. Receipts prevent duplicate record mutations, but
  existing post-commit event/workflow callbacks can still be lost in a server crash.
- Bounded history/storage growth, larger-data performance, richer import/export,
  permission-change acceptance, and more extensive device/browser testing.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the target contracts.
