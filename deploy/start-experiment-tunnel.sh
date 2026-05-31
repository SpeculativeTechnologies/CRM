#!/bin/bash
# =============================================================================
# EXPERIMENT public access via Cloudflare quick tunnels (no account, no DNS).
# =============================================================================
# Exposes the running dev servers (front :3001, back :3000) on two random
# *.trycloudflare.com HTTPS URLs, wires the URLs into the .env files, and
# restarts the dev stack so the frontend talks to the backend's public URL.
#
# These URLs are EPHEMERAL — they change every time you run this. For a stable
# crm.spec.tech, move spec.tech to Cloudflare and use deploy/setup-tunnel.sh.
#
# Usage:  bash deploy/start-experiment-tunnel.sh
#         (then run `yarn start` yourself, or let this script restart it)
# =============================================================================
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CFD=/opt/homebrew/bin/cloudflared

echo "Stopping any existing quick tunnels..."
pkill -f "cloudflared tunnel --url" 2>/dev/null || true
sleep 1

echo "Starting quick tunnels..."
$CFD tunnel --url http://127.0.0.1:3000 --no-autoupdate > /tmp/cf-back.log 2>&1 &
$CFD tunnel --url http://localhost:3001 --no-autoupdate > /tmp/cf-front.log 2>&1 &

echo "Waiting for tunnel URLs..."
for i in $(seq 1 30); do
  BACK=$(grep -ahoE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/cf-back.log  | head -1)
  FRONT=$(grep -ahoE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/cf-front.log | head -1)
  [ -n "$BACK" ] && [ -n "$FRONT" ] && break
  sleep 1
done
[ -n "${BACK:-}" ] && [ -n "${FRONT:-}" ] || { echo "Failed to get tunnel URLs"; exit 1; }

echo "  FRONT: $FRONT"
echo "  BACK:  $BACK"

echo "Wiring .env files..."
sed -i '' "s|^REACT_APP_SERVER_BASE_URL=.*|REACT_APP_SERVER_BASE_URL=${BACK}|" "$REPO_ROOT/packages/twenty-front/.env"
grep -q '^VITE_ALLOWED_HOSTS=' "$REPO_ROOT/packages/twenty-front/.env" \
  || printf '\nVITE_ALLOWED_HOSTS=.trycloudflare.com\n' >> "$REPO_ROOT/packages/twenty-front/.env"
sed -i '' "s|^FRONTEND_URL=.*|FRONTEND_URL=${FRONT}|" "$REPO_ROOT/packages/twenty-server/.env"
if grep -q '^SERVER_URL=' "$REPO_ROOT/packages/twenty-server/.env"; then
  sed -i '' "s|^SERVER_URL=.*|SERVER_URL=${BACK}|" "$REPO_ROOT/packages/twenty-server/.env"
else
  printf 'SERVER_URL=%s\n' "$BACK" >> "$REPO_ROOT/packages/twenty-server/.env"
fi

echo
echo "Tunnels up. Now (re)start the dev stack so it picks up the new env:"
echo "    cd $REPO_ROOT && yarn start"
echo
echo "Then open:  $FRONT   (sign in with the prefilled demo credentials)"
