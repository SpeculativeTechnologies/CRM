#!/bin/bash
# =============================================================================
# Live (hot-reloading) frontend, reachable from your OTHER Tailscale devices.
# =============================================================================
# The public Funnel URL serves the *built* frontend (dev mode's ~1900 module
# requests choke the public relay). But over Tailscale DIRECTLY (device-to-device,
# private, no relay) the full dev server streams fine — so use this to develop
# with hot reload and view it from another computer on your tailnet.
#
# On the other computer: install Tailscale + log into the same account, then open
#     http://spectech-llm-1.tail7ba35e.ts.net:3001
#
# Edits hot-reload live. API is proxied to the always-on backend (:3000).
# Runs the dev server bound to the Tailscale IP only (not your LAN).
# =============================================================================
set -uo pipefail
export PATH="/opt/homebrew/bin:$PATH"
eval "$(fnm env --shell bash)" 2>/dev/null || true
fnm use 24.5.0 >/dev/null 2>&1 || true
cd /Users/ben/Projects/twenty

TSIP="$(/Applications/Tailscale.app/Contents/MacOS/Tailscale ip -4 2>/dev/null | head -1)"
TSIP="${TSIP:-0.0.0.0}"
echo "Serving live dev frontend on http://${TSIP}:3001 (tailnet) ..."
echo "Open from another tailnet device: http://spectech-llm-1.tail7ba35e.ts.net:3001"
exec npx nx start twenty-front -- --host "$TSIP"
