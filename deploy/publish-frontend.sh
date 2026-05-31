#!/bin/bash
# =============================================================================
# Publish frontend changes to the public URL.
# =============================================================================
# Rebuilds the production frontend bundle and restarts the preview server so the
# public Tailscale Funnel URL serves the new code. (Backend changes hot-reload
# automatically and do NOT need this.)
#
# Usage:  bash deploy/publish-frontend.sh
# =============================================================================
set -euo pipefail

export PATH="/opt/homebrew/bin:$PATH"
eval "$(fnm env --shell bash)" 2>/dev/null || true
fnm use 24.5.0 >/dev/null 2>&1 || true

REPO_ROOT="/Users/ben/Projects/twenty"
cd "$REPO_ROOT"

echo "[publish] building frontend..."
npx nx build twenty-front

echo "[publish] restarting preview server..."
# The launchd-managed serve-public.sh owns the preview process; restarting that
# service rebuilds the whole public stack and re-serves the fresh build.
if launchctl list 2>/dev/null | grep -q com.twenty.public; then
  launchctl kickstart -k "gui/$(id -u)/com.twenty.public"
  echo "[publish] kicked com.twenty.public (preview will serve the new build)"
else
  # Not running under launchd: just bounce the preview process.
  pkill -f "vite preview" 2>/dev/null || true
  ( cd packages/twenty-front && nohup npx vite preview > /tmp/twenty-preview.log 2>&1 & )
  echo "[publish] restarted standalone vite preview"
fi

echo "[publish] done — public URL now serves the new frontend."
