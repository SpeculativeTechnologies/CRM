#!/bin/bash
# =============================================================================
# Bring the local backend in sync with the code after a git pull/merge.
# =============================================================================
# After merging upstream, the backend can declare new NON-NULLABLE GraphQL
# fields whose DB columns / cached metadata don't exist yet. The app then boots
# to a BLANK SCREEN with, e.g.:
#     Cannot return null for non-nullable field View.isActive
#     Cannot return null for non-nullable field CommandMenuItem.isActive
#
# Fixing it needs THREE steps (the migration alone is not enough):
#   0. yarn install                — install any new deps the upstream bump added
#                                    (else build/migrate crash with MODULE_NOT_FOUND).
#   1. database:migrate            — apply pending instance-command migrations
#                                    that ADD the new columns.
#   2. cache:flat-cache-invalidate — drop stale flat-entity maps in Redis so the
#                                    "overridable entities" (View, CommandMenuItem,
#                                    ...) are rebuilt from the new schema. Without
#                                    this the resolver keeps returning null even
#                                    though the column now exists.
#
# Idempotent and safe to run anytime. Runs automatically via the git post-merge
# hook (.git/hooks/post-merge), or run it by hand:  bash deploy/update-after-merge.sh
# The always-on backend (watch mode) picks up the new schema on the next request
# — no restart needed.
# =============================================================================
set -uo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/opt/postgresql@16/bin:$PATH"
eval "$(fnm env --shell bash)" 2>/dev/null || true
fnm use 24.5.0 >/dev/null 2>&1 || true

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Datastores must be up; if not, bail with a clear message instead of hanging.
if ! pg_isready -h localhost -p 5432 -q 2>/dev/null; then
  echo "[update-after-merge] Postgres not up on :5432 — start it (brew services start postgresql@16), then re-run: bash deploy/update-after-merge.sh"
  exit 0
fi
if ! redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q PONG; then
  echo "[update-after-merge] Redis not up on :6379 — start it (brew services start redis), then re-run: bash deploy/update-after-merge.sh"
  exit 0
fi

# 0. Install deps FIRST. Upstream bumps frequently add new packages (e.g. the
#    v2.18.0 CalDAV driver pulled in ical-generator); without this the build +
#    migrate crash with MODULE_NOT_FOUND and the backend crash-loops.
echo "[update-after-merge] 1/3 installing dependencies (yarn install)..."
if ! yarn install; then
  echo "[update-after-merge] yarn install FAILED (see output above)"; exit 1
fi

echo "[update-after-merge] 2/3 applying pending DB instance-command migrations..."
if ! npx nx run twenty-server:database:migrate; then
  echo "[update-after-merge] database:migrate FAILED (see output above)"; exit 1
fi

echo "[update-after-merge] 3/3 invalidating stale flat-entity cache (Redis)..."
if ! npx nx run twenty-server:command -- cache:flat-cache-invalidate --all-metadata; then
  echo "[update-after-merge] cache:flat-cache-invalidate FAILED (see output above)"; exit 1
fi

echo "[update-after-merge] done — backend will serve the new schema on the next request."
echo "[update-after-merge] (FRONTEND changes still need a republish: bash deploy/publish-frontend.sh)"
