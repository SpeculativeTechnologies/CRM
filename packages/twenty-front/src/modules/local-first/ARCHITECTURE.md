# Proposed local-first CRM architecture

This is an architectural refactor of the existing CRM. The current spike is not a local-first write path and must remain opt-in until the following contracts are implemented and verified.

## Observable outcome

A user opens their existing workspace, disconnects, edits a contact, adds a field and changes a view, reloads, and sees the same work. Reconnecting exchanges changes with the shared workspace. Concurrent edits remain recoverable. A second account cannot open the first account's local replica. Users can export the data and the definitions that make their tools work.

## Local replica

One durable database per server/workspace/user, behind a worker that coordinates browser tabs. Store replicated records, declarative object/field/view definitions, an operation journal, unresolved conflicts, and sync checkpoints. Commit an edit and its journal entry atomically before reporting that it is saved. Persist schema and completed sync state so a restart does not depend on a schema HTTP request.

Server snapshots and local pending changes are separate. Incoming sync must not overwrite pending work. A snapshot is usable only after all tables needed for a query have completed their initial sync. Checkpoints commit in the same transaction as their rows. Expired shapes replace the old server snapshot atomically; they never discard unsynced changes.

## Reconciliation

Use the existing server's permissions, validation, relations, audit events and integrations. Add explicit operation IDs and atomic compare-and-set/revision checks for replay. Do not put arbitrary GraphQL operations in a retry queue: sends, workflows, merges and externally observable actions are not safely replayable. A rejected mutation remains visible and recoverable locally.

Merge independent field edits, preserve both values for conflicting scalar edits, and use an appropriate text CRDT for collaborative rich text. Never describe a last-writer-wins queue as equivalent to collaborative local-first storage.

## Malleable tools

Object, field and view definitions are ordinary versioned data with stable IDs. A view is a named projection/filter/sort over records. Users can duplicate and edit a view at the point of use, undo changes, and export/import its definition. Runtime interprets definitions without rebuilding the application. Start with objects, fields and views; scripts, custom screens and external automation require separate capability contracts.

Personal definitions and shared schema need distinct scopes. A personal experiment must not silently mutate everyone's workspace schema. Publishing a personal definition must show a reviewable diff and the migration/compatibility effects. Removing a field must retain its values in history or an export rather than silently destroy data.

## Integration sequence

1. Scoped storage, worker ownership, durable schema/checkpoints, cancellation and complete-snapshot reads. This branch implements that foundation; see NOTES.md for current limits.
2. Versioned/idempotent server mutation contract and a durable local operation journal.
3. Wire existing record editing to local commits, with reconnect/conflict UI and cross-tab tests.
4. Persist startup metadata and serve the application shell offline; test offline reload and session expiry.
5. Declarative local definitions and editing tools, then explicit sharing of schema changes.
6. Replace the fixed object/relation allowlists with permission-aware metadata-driven replication.

Each step requires focused behavior tests. Final acceptance must cover the full offline/edit/reload/reconnect interaction on the verified mirror, plus synthetic screenshots, static checks and exact-commit CI. No production or staging deployment is included.

## Original spike limitations (some addressed by this branch)

- The database directory and global singleton are not scoped by account or workspace.
- The schema must be fetched from the server on every cold start.
- Sync loops have no teardown and start before authentication is established.
- Sync offsets are memory-only; restarted snapshots leave stale deleted rows behind.
- Query planning checks schema coverage but not completion of table sync.
- The read link always issues a network request; a network error can beat a usable local answer.
- The proxy has workspace authentication but no object/field permission filtering.
- Writes go through server mutations and are rolled back by the existing hooks on network failure.

References: https://www.inkandswitch.com/essay/local-first/ and https://www.inkandswitch.com/essay/malleable-software/.
