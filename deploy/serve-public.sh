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

REPO_ROOT="/Users/ben/Projects/twenty"
cd "$REPO_ROOT"

echo "[serve-public] waiting for postgres + redis..."
until pg_isready -h localhost -p 5432 -q 2>/dev/null; do sleep 2; done
until redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q PONG; do sleep 2; done
echo "[serve-public] datastores up; starting services"

npx nx run twenty-server:start & SVPID=$!
npx nx run twenty-server:worker & WKPID=$!
( cd packages/twenty-front && npx vite preview ) & PVPID=$!

# Tear down all children when this script is told to stop.
trap 'kill $SVPID $WKPID $PVPID 2>/dev/null' EXIT INT TERM

# If any component dies, exit so launchd (KeepAlive) restarts the whole stack.
# (macOS ships bash 3.2, which lacks `wait -n`, so poll the PIDs.)
while kill -0 $SVPID 2>/dev/null && kill -0 $WKPID 2>/dev/null && kill -0 $PVPID 2>/dev/null; do
  sleep 5
done
echo "[serve-public] a component exited; stopping so launchd restarts the stack"
exit 1
