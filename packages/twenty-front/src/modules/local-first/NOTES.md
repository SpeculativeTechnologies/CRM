# Local-first CRM: replica foundation

The local-first experiment remains **opt-in and read-only**. This branch
refactors its replica and read path. It does not yet make the entire CRM work
offline or provide editable local tools. See [ARCHITECTURE.md](ARCHITECTURE.md)
for the remaining architecture and the intended user interaction.

## What this implementation provides

- A durable browser Postgres replica scoped by API server, workspace and user.
  PGlite runs in a worker and coordinates database access across tabs.
- Schema and sync checkpoints persisted beside the replicated data. Reopening
  an existing replica does not require fetching schema from the server.
- Rows and their checkpoint commit in one transaction. A failed batch leaves
  both unchanged. Partial updates preserve omitted fields; repeated changes
  to a row replay in order.
- Initial snapshots remain unavailable to local reads until complete. Every
  relation needed by a query must also have a complete snapshot. The reads
  and readiness check use the same transaction.
- An expired Electric shape clears its stale snapshot and resets its checkpoint.
  Custom field changes rebuild the affected **server replica**, then resync it.
  Locally authored data must never be placed in those replaceable tables.
- One cancellable sync owner per scope, coordinated through Web Locks. Signing
  out or changing the workspace stops requests and timers for the old scope.
- With local serving enabled, supported People reads return without sending a
  GraphQL request. Unsupported selections, incomplete replicas, pagination and
  local storage failures fall back to the existing server path. Shadow mode
  still compares local results with the server without serving them.

The previous unscoped `twenty-local-first-v4` database is not imported: its
rows cannot be attributed safely to an account or workspace. This code leaves
it untouched and creates new scoped replicas from the server.

## Enable the experiment in a developer environment

The existing flags remain disabled by default:

- `REACT_APP_IS_LOCAL_FIRST_ENABLED=true` enables the replica and debug panel.
- `REACT_APP_IS_LOCAL_FIRST_READS_ENABLED=true` additionally serves local reads.
- The server requires `ELECTRIC_URL`, with Electric available only through its
  authenticated shape proxy. The browser never specifies a workspace schema.

The current table allowlist remains unchanged. This is not permission-complete:
although the proxy authenticates and scopes requests to a workspace, it does
not apply object/field/row permissions to the shape. Do not widen the allowlist
or enable the experiment for general team use until that is resolved. No
production or staging infrastructure is configured by this branch.

## Verification

`services/__tests__/localFirstReplica.test.ts` runs real Postgres WASM checks
in a native Node subprocess. This avoids Jest VM's restriction on the dynamic
native imports used by Emscripten; the database is not mocked. Its behavior
runner checks persistence after reopening, transactional rollback, repeated
record changes, partial updates, expired shapes and schema replacement.
Other focused tests cover account/workspace/server identity and local query
routing, including cancellation and network fallback.

Run the explicit test files from the package directory, or use
`--runTestsByPath`. A broad `local-first` pattern can match every test when
that phrase occurs in the worktree path. Run `yarn check:local` for the required
frontend/server lint and typechecks.

## Remaining work

- Durable local edits, operation identity, version checks, conflict preservation
  and reconciliation through server validation and permissions.
- Offline app shell, startup metadata and record-detail reads. A persisted
  replica alone does not make a full-page offline reload work.
- Versioned, editable object/field/view definitions, undo and portable exports.
- Permission-aware replication derived from metadata, wider object coverage,
  cursor pagination, filtering and reactive query invalidation.
- Visible sync/conflict controls, explicit local-data removal, performance
  measurement and complete acceptance on the mirrored CRM.
