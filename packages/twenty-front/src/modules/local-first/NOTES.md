# Local-first spike -- status and next steps

Goal: make Twenty local-first in the Ink & Switch sense -- instant local
reads/writes, works offline, syncs to the shared Postgres in the background.
This is a proof-of-concept, not a shipped feature. Nothing here is wired into
the real record-table/record-board data path yet.

## What exists right now

- **Sync engine**: ElectricSQL, added to `packages/twenty-docker/docker-compose.dev.yml`
  behind a `local-first` profile (`docker compose ... --profile local-first up -d`).
  Reads Postgres's logical replication stream (`wal_level=logical`, also set in
  that compose file) and serves HTTP "shape" subscriptions.
- **Local database**: `@electric-sql/pglite` (real Postgres compiled to WASM),
  opened lazily in `services/getLocalFirstDatabase.ts`, persisted to IndexedDB
  in the browser tab.
- **Sync loop**: `services/syncPersonShapeToLocalFirstDatabase.ts` polls
  Electric's HTTP shape API directly (plain `fetch`, not the official
  `@electric-sql/client`/`pglite-sync` packages -- see "Known issues" below)
  and upserts rows into the local `person` table.
- **Proof surface**: `components/LocalFirstDebugPanel.tsx`, mounted in
  `app/components/App.tsx`, a small floating panel showing sync status and
  row count. Only renders when `REACT_APP_LOCAL_FIRST_WORKSPACE_SCHEMA` is set.
  This is a debug affordance, not a real feature -- delete it once the real
  integration (see Phase 2 below) lands.
- Covers exactly one object (`person`) and a handful of its fields (see
  `constants/LOCAL_FIRST_PERSON_COLUMNS.ts`).

## Known issues / deliberate shortcuts

1. **Workspace schema is hardcoded via env var**, not resolved per logged-in
   user. `LOCAL_FIRST_WORKSPACE_SCHEMA` (`constants/LOCAL_FIRST_WORKSPACE_SCHEMA.ts`)
   reads `REACT_APP_LOCAL_FIRST_WORKSPACE_SCHEMA` from `.env`. Real
   implementation needs a small authenticated backend endpoint that returns
   the current workspace's `databaseSchema` (not currently exposed via
   GraphQL -- checked, it isn't).
2. **No auth in front of Electric.** `ELECTRIC_INSECURE=true` in the dev
   compose file means anyone who knows the workspace schema name can read all
   of it via Electric's HTTP API on port 3010. Fine for a single-workspace
   local dev box, not fine to expose beyond that. Needs a small proxy that
   checks the caller's JWT/workspace before forwarding to Electric.
3. **Hand-rolled sync loop instead of the official Electric client.** In
   testing, `@electric-sql/client`'s `ShapeStream` (and `pglite-sync`'s
   `syncShapeToTable`, which wraps it) never issued a request or surfaced an
   error, even after fixing all import/bundling issues -- confirmed via
   `hasStarted`/`isLoading`/`isConnected` all staying `null`. Root cause not
   found. The current code works around this with a plain `fetch` poll loop
   against Electric's REST API, which is correct but lacks the official
   client's batching (see #4) and doesn't do real long-polling (falls back to
   a 3s timer once caught up). Worth re-investigating before this goes beyond
   spike stage -- the official client would also give proper `live` mode.
4. **No insert batching.** `applyMessages` does one `INSERT ... ON CONFLICT`
   per row. Syncing the full `person` table (~6,200 rows in the current
   mirror) takes a few minutes. Fine for a spike, not for production --
   batch inserts in a transaction.
5. **Generated columns must be excluded explicitly.** Postgres
   `GENERATED ALWAYS` columns (e.g. `person.searchVector`) can't travel over
   logical replication, so any new object's column list needs the same
   exclusion `LOCAL_FIRST_PERSON_COLUMNS.ts` does for `person`.
6. **127.0.0.1, not localhost, for the Electric URL.** A `localhost:3001` page
   fetching `localhost:3010` fails silently in Chrome ("Failed to fetch", no
   CORS error surfaced) but works against `127.0.0.1:3010`. Cause not fully
   nailed down (looked like a CORS/network-permission quirk specific to
   same-hostname-different-port); see `constants/LOCAL_FIRST_ELECTRIC_URL.ts`.
7. **Read-only.** This only proves data flowing Postgres -> local. No local
   write path, no offline mutation queue.

## Next steps (Phase 2+)

In rough order:

1. **Backend endpoint for workspace schema name**, replacing the env var
   hack, so this can work for whoever's logged in rather than one hardcoded
   workspace.
2. **Auth proxy in front of Electric** so a device only syncs its own
   workspace's data.
3. **Real UI integration**: this is the big one. Right now the actual
   Companies/People pages still go through Apollo -> GraphQL -> Postgres for
   every read, exactly as before -- local-first isn't visible anywhere except
   the debug panel. Making the app actually feel local-first means rewiring
   `useFindManyRecords` (or a new parallel hook) and the record-table/
   record-board rendering path to read from the local PGlite database for
   synced object types, instead of firing a GraphQL query. That's a
   significant, invasive change to `packages/twenty-front/src/modules/object-record`
   and needs its own design pass, not a quick patch.
4. **Write path**: local mutation outbox -- queue create/update/delete
   locally when offline, replay through the existing GraphQL mutations
   (reusing/extending `modules/apollo/optimistic-effect/`) when back online.
   Writes should keep going through GraphQL mutations, not direct-to-Postgres,
   so all the existing validation/permissions/custom-object logic still runs.
5. **Expand object coverage** beyond `person` once the pattern above is
   proven, and figure out how newly-added custom fields/objects (workspace
   metadata changes) get their shape definitions kept in sync.
6. **Decide whether to keep fighting the official Electric client** (#3
   above) or commit to the hand-rolled poller long-term -- the official
   client would matter more once real-time push (not 3s polling) and
   multi-table shape management are needed.

## Running it locally

```bash
# one-time / after docker-compose changes:
docker compose -f packages/twenty-docker/docker-compose.dev.yml --profile local-first up -d

# packages/twenty-front/.env needs:
REACT_APP_LOCAL_FIRST_WORKSPACE_SCHEMA=workspace_xxxxxxxxxxxx  # from core.workspace.databaseSchema
```

Then run the app as usual. The debug panel appears bottom-right once the
schema env var is set.
