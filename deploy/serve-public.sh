#!/bin/bash
# =============================================================================
# Always-on PUBLIC Twenty stack (served at the Tailscale Funnel URL).
# =============================================================================
# Runs the backend (watch mode -> backend edits hot-reload live), the worker,
# and `vite preview` serving the BUILT frontend on :3010. Tailscale Funnel
# (configured separately, persists across reboots) proxies the public HTTPS URL
# to :3010.
#
# Frontend changes do NOT appear here until you publish:  deploy/publish-frontend.sh
# For live FRONTEND development, run a dev server on :3001 against this backend:
#     npx nx start twenty-front     (open http://localhost:3001)
#
# Launched at login by ~/Library/LaunchAgents/com.twenty.public.plist
# =============================================================================
set -uo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/opt/postgresql@16/bin:$PATH"
eval "$(fnm env --shell bash)" 2>/dev/null || true
fnm use 24.5.0 >/dev/null 2>&1 || true

# Resolve the repo this script lives in, so the same script works from any
# clone (dev checkout, ~/Deploy/twenty, ...). The deploy clone is canonical.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[serve-public] waiting for postgres + redis..."
until pg_isready -h localhost -p 5432 -q 2>/dev/null; do sleep 2; done
until redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q PONG; do sleep 2; done
echo "[serve-public] datastores up; starting services"

# twenty-shared is consumed through a node_modules symlink, and the server and
# worker import its built entry bundles (dist/utils.cjs, dist/database-events.cjs,
# ...). Nothing else in this script builds it, so a wiped or half-written dist
# makes every generation die with MODULE_NOT_FOUND before :3000 ever binds --
# and because we exit 1 on that, launchd restarts us into a tight loop.
# (2026-07-21: 18 restarts, 328MB of log, site served only by a stale orphan.)
# The nx build is cached, so this costs seconds when dist is already valid.
echo "[serve-public] ensuring twenty-shared is built..."
if ! npx nx build twenty-shared || [ ! -f packages/twenty-shared/dist/utils.cjs ]; then
  echo "[serve-public] FATAL: twenty-shared build failed or dist is incomplete."
  # Sleep before exiting: the supervisor restarts us immediately, and a fast
  # exit here is what turns a build problem into a log-filling restart storm.
  sleep 60
  exit 1
fi

WKPID=""
# 8GB heap: the default ~4GB has OOM'd under Gmail/Calendar sync + bulk imports.
NODE_OPTIONS="--max-old-space-size=8192" npx nx run twenty-server:start & SVPID=$!
node deploy/serve-frontend.mjs & PVPID=$!

# Tear down all children when this script is told to stop.
trap 'kill $SVPID $WKPID $PVPID 2>/dev/null' EXIT INT TERM

# Start the worker only AFTER the API server has finished `rimraf dist` + build
# and is listening on :3000. The server (start) and worker both compile into the
# SAME dist/, and the server's `rimraf dist` wipes the worker's freshly-built
# files mid-run -> MODULE_NOT_FOUND crash-loop. Sequencing avoids that race.
echo "[serve-public] waiting for backend :3000 before starting worker..."
until curl -sf -o /dev/null --max-time 3 http://127.0.0.1:3000/healthz 2>/dev/null; do
  kill -0 $SVPID 2>/dev/null || { echo "[serve-public] backend died during startup; exiting so launchd restarts"; exit 1; }
  sleep 3
done
echo "[serve-public] backend up; starting worker"
npx nx run twenty-server:worker & WKPID=$!

# Register all background cron jobs (messaging/calendar sync, trash cleanup,
# webhook-subscription renewal, workflow crons, ...). The worker PROCESSES queued
# jobs but does NOT schedule them; without this, repeatable crons never get
# registered in Redis (bull:cron-queue:repeat empty) and Gmail/Calendar sync
# stalls after the first batch ("Importing" forever). Run against the prebuilt
# dist (NOT `nx run … command`, which rebuilds dist and trips the rimraf race).
echo "[serve-public] registering background cron jobs..."
( cd "$REPO_ROOT/packages/twenty-server" && node dist/command/command cron:register:all ) \
  || echo "[serve-public] WARN: cron:register:all failed — sync/cleanup crons not scheduled"

# If any component dies, exit so launchd (KeepAlive) restarts the whole stack.
# (macOS ships bash 3.2, which lacks `wait -n`, so poll the PIDs.)
while kill -0 $SVPID 2>/dev/null && kill -0 $WKPID 2>/dev/null && kill -0 $PVPID 2>/dev/null; do
  sleep 5
done
echo "[serve-public] a component exited; stopping so launchd restarts the stack"
exit 1
