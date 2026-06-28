#!/bin/bash
# =============================================================================
# Publish frontend changes to the public URL.
# =============================================================================
# Rebuilds the production frontend bundle. serve-frontend.mjs serves the build
# dir live (sirv dev mode, per-request stat), so the new bundle is served as
# soon as the build finishes — no server restart. (Backend changes hot-reload
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

# No server restart needed: serve-frontend.mjs (sirv dev mode) stats the build
# dir per request, so the freshly-built bundle is served immediately. The old
# code tried to bounce `vite preview`, but the stack runs serve-frontend.mjs on
# :3010 — that pkill matched nothing and left the real server serving a stale
# startup snapshot, 404'ing every new content-hashed asset -> blank pages.
echo "[publish] done — public URL now serves the new frontend (served live, no restart)."
