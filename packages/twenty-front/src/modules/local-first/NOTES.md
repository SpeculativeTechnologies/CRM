# Local-first spike -- status and next steps

Goal: make Twenty local-first in the Ink & Switch sense -- instant local
reads/writes, works offline, syncs to the shared Postgres in the background.
This is a proof-of-concept, not a shipped feature. Nothing here is wired into
the real record-table/record-board data path yet.

## What exists right now

- **Sync engine**: ElectricSQL, added to `packages/twenty-docker/docker-compose.dev.yml`
  behind a `local-first` profile (`docker compose ... --profile local-first up -d`).
  Reads Postgres's logical replication stream (`wal_level=logical`, also set in
  that compose file) and serves HTTP "shape" subscriptions. Bound to loopback
  only -- nothing but the twenty-server proxy should reach it.
- **Auth proxy**: `GET /local-first/shape/:tableName` on twenty-server
  (`engine/core-modules/local-first/`). Authenticates the caller with the
  same middleware/guard chain as `/metadata` (session cookie or bearer
  token), resolves the workspace's Postgres schema from
  `workspace.databaseSchema`, and forwards to Electric with a server-side
  whitelist of tables and columns
  (`constants/local-first-synced-tables.constant.ts`). The browser never
  talks to Electric directly and never names a schema. Enabled by setting
  `ELECTRIC_URL` on the server; without it the route answers 404.
- **Local database**: `@electric-sql/pglite` (real Postgres compiled to WASM),
  opened lazily in `services/getLocalFirstDatabase.ts`, persisted to IndexedDB
  in the browser tab.
- **Sync loop**: `services/syncPersonShapeToLocalFirstDatabase.ts` polls the
  shape proxy (plain `fetch`, not the official
  `@electric-sql/client`/`pglite-sync` packages -- see "Known issues" below)
  and applies rows to the local `person` table in batched, transactional
  multi-row upserts.
- **Proof surface**: `components/LocalFirstDebugPanel.tsx`, mounted in
  `app/components/App.tsx`, a small floating panel showing sync status and
  row count. Only renders when `REACT_APP_IS_LOCAL_FIRST_ENABLED=true`.
  This is a debug affordance, not a real feature -- delete it once the real
  integration (see Phase 2 below) lands.
- Covers exactly one object (`person`) and a handful of its fields (see
  `constants/LOCAL_FIRST_PERSON_COLUMNS.ts`, mirrored server-side in the
  synced-tables whitelist).

## Known issues / deliberate shortcuts

1. **Hand-rolled sync loop instead of the official Electric client.** In
   testing, `@electric-sql/client`'s `ShapeStream` (and `pglite-sync`'s
   `syncShapeToTable`, which wraps it) never issued a request or surfaced an
   error, even after fixing all import/bundling issues -- confirmed via
   `hasStarted`/`isLoading`/`isConnected` all staying `null`. Root cause not
   found. The current code works around this with a plain `fetch` poll loop,
   which is correct but doesn't do real long-polling (falls back to a 3s
   timer once caught up; the proxy already forwards the `live` and `cursor`
   params when the client starts sending them). Worth re-investigating
   before this goes beyond spike stage.
2. **Generated columns must be excluded explicitly.** Postgres
   `GENERATED ALWAYS` columns (e.g. `person.searchVector`) can't travel over
   logical replication, so any new object's column list needs the same
   exclusion `person` gets in the server-side whitelist.
3. **Column whitelist is duplicated** between the server
   (`local-first-synced-tables.constant.ts`, authoritative) and the frontend
   (`LOCAL_FIRST_PERSON_COLUMNS.ts`, used to create the local table). Worth
   moving to `twenty-shared` once more objects sync.
4. **No field-level permission filtering.** The proxy scopes by workspace,
   which matches how this single-workspace fork runs, but Electric shapes
   bypass per-role field permissions -- revisit before syncing objects with
   restricted fields.
5. **Read-only.** This only proves data flowing Postgres -> local. No local
   write path, no offline mutation queue.
6. **Deploy prerequisite**: `local-first` is a new `ApiPath` prefix, so the
   deployed reverse proxy (crm-ops) must route it to the server before this
   works anywhere but local dev, and an Electric service (loopback-only,
   `ELECTRIC_URL` set on the server) must run next to Postgres with
   `wal_level=logical`.

## Done since the spike

- ~~Workspace schema hardcoded via env var~~ -- resolved per logged-in user
  by the shape proxy from `workspace.databaseSchema`.
- ~~No auth in front of Electric~~ -- Electric is loopback-only and every
  shape request authenticates through the server proxy.
- ~~No insert batching~~ -- shape batches now apply as transactional
  multi-row upserts (order-preserving around deletes).
- ~~127.0.0.1-vs-localhost fetch quirk~~ -- moot; the browser only talks to
  the API origin now.

## Next steps (Phase 2+)

In rough order:

1. **Real UI integration**: this is the big one. Right now the actual
   Companies/People pages still go through Apollo -> GraphQL -> Postgres for
   every read, exactly as before -- local-first isn't visible anywhere except
   the debug panel. Making the app actually feel local-first means rewiring
   `useFindManyRecords` (or a new parallel hook) and the record-table/
   record-board rendering path to read from the local PGlite database for
   synced object types, instead of firing a GraphQL query. That's a
   significant, invasive change to `packages/twenty-front/src/modules/object-record`
   and needs its own design pass, not a quick patch.
2. **Write path**: local mutation outbox -- queue create/update/delete
   locally when offline, replay through the existing GraphQL mutations
   (reusing/extending `modules/apollo/optimistic-effect/`) when back online.
   Writes should keep going through GraphQL mutations, not direct-to-Postgres,
   so all the existing validation/permissions/custom-object logic still runs.
3. **Expand object coverage** beyond `person` once the pattern above is
   proven, and figure out how newly-added custom fields/objects (workspace
   metadata changes) get their shape definitions kept in sync.
4. **Decide whether to keep fighting the official Electric client** (known
   issue #1) or commit to the hand-rolled poller long-term -- the official
   client would matter more once real-time push (not 3s polling) and
   multi-table shape management are needed.

## Running it locally

```bash
# one-time / after docker-compose changes:
docker compose -f packages/twenty-docker/docker-compose.dev.yml --profile local-first up -d

# packages/twenty-server/.env:
ELECTRIC_URL=http://127.0.0.1:3010

# packages/twenty-front/.env:
REACT_APP_IS_LOCAL_FIRST_ENABLED=true
```

Then run the app as usual. The debug panel appears bottom-right once the
frontend flag is set.
