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

## Local reads (Phase 3)

The People list can now be answered from the browser's Postgres with no list
query on the wire. Two independent flags:

- `REACT_APP_IS_LOCAL_FIRST_ENABLED` -- sync and compare. Local reads are
  computed and checked against the server's answer, but the server's answer is
  what renders.
- `REACT_APP_IS_LOCAL_FIRST_READS_ENABLED` -- also serve them. Only meaningful
  with the first flag on.

Shape of it:

- `services/getLocalFirstMirror.ts` builds the mirror once: fetches each
  table's columns from `GET /local-first/schema/:table` and creates the local
  tables from that. `tryGetReadyLocalFirstMirror()` returns it only if already
  built -- reads never wait on PGlite booting, because that made a cold page
  slower than asking the server.
- `services/startLocalFirstSync.ts` runs one independent loop per table, so a
  lagging table does not stall the others.
- `utils/buildLocalReadPlan.ts` turns a query's selection into a plan, or
  refuses. It only understands declared relations
  (`constants/LOCAL_FIRST_RELATION_SOURCES.ts`) and mirrored columns.
- `services/executeLocalReadPlan.ts` runs the plan and assembles API-shaped
  records, fetching each relation once per page rather than per row.
- `services/createLocalFirstReadLink.ts` serves the result when serving is on,
  and otherwise forwards and compares.

Why five tables for one list: the record table requests every field of the
object plus its relations, and a local read must answer the whole selection or
fall back. Twenty models many-to-many through a first-class join object, so
People reaches person, company, `_petCareAgreement`, `_pet` and
`_employmentHistory`.

Verified: 60 of 60 rows agree with the server across 2136 compared fields,
relations included; the table renders from local with zero GraphQL calls.

### Traps found here, do not re-learn them

1. **Boolean and numeric columns silently synced nothing.** Electric sends
   Postgres text format ("false", "1234.5") and PGlite's parameter serialiser
   rejects it. `utils/coerceValueForLocalColumn.ts` coerces by column type.
2. **The sync advanced its offset before applying**, so any apply failure
   skipped that batch forever -- which is why the above was invisible rather
   than loud.
3. **To-many relations came back empty** because the target plan did not
   select the back-reference column it groups by.
4. **Serving is not comparing.** The comparison normalises a `Date` and an ISO
   string to equal on purpose, so it could not catch that serving handed the
   UI a `Date` where the API sends a string -- which crashed the date field
   and blanked the table via the error boundary. `utils/toApiValue.ts`.
5. **Composites flatten two ways**: `name { firstName }` is the column
   `nameFirstName`, `avatarFile { url }` is one jsonb column.
   `utils/resolveLocalFieldSource.ts` handles both.
6. **Absence is not a divergence.** A field a view does not display is not
   selected, so it is missing from the response.
7. Two PGlite instances on one IndexedDB directory block each other; the
   mirror must stay a singleton.

### Not yet measured

The speed claim is **not** demonstrated. Warm tab switches were already
instant from Apollo's cache in both modes, and dev-server timings are
meaningless for paint (see the `twenty-front-perf-benchmark` skill). Proving
the win needs a production build with emulated tunnel latency, measuring
`roundTripsToPaint` on the paths that actually hit the network: first view of
a page, pagination, filter and sort changes, and post-resync refetches.

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

1. **Measure it.** Production build, emulated latency, `roundTripsToPaint`
   before and after. Until that exists there is no evidence this is faster,
   only that it is correct.
2. **Widen the supported subset.** View filters and sorts are the common
   cases still reported `unsupported`, and they are what people actually use.
   Cursor pagination too.
3. **Cold start.** The mirror takes seconds to build on a fresh page, so the
   first view of a session always falls back. Persisting the schema and
   keeping PGlite warm across navigations would close that.
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
