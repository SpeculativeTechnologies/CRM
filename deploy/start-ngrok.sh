#!/bin/bash
# =============================================================================
# Stable public URL for Twenty dev via ngrok (single static domain, free tier).
# =============================================================================
# Twenty's dev frontend (:3001) proxies all backend routes to :3000 (Vite proxy,
# see vite.config.ts VITE_PROXY_API_TO), so the whole app is ONE origin and a
# single ngrok tunnel to :3001 serves everything — including OAuth callbacks
# for email/calendar sync.
#
# One-time setup (you do this once in the ngrok dashboard):
#   1. Create a free account at https://dashboard.ngrok.com
#   2. Copy your authtoken (Getting Started > Your Authtoken) and run:
#        ngrok config add-authtoken <YOUR_AUTHTOKEN>
#   3. Reserve your free static domain (Universal Gateway > Domains > New).
#      It looks like  <something>.ngrok-free.app  and never changes.
#   4. Put it in this repo's env so links/OAuth use it:
#        deploy/start-ngrok.sh <your-domain.ngrok-free.app>
#      (or set NGROK_DOMAIN in your shell)
#
# Usage:
#   bash deploy/start-ngrok.sh <your-domain.ngrok-free.app>
# =============================================================================
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGROK=/opt/homebrew/bin/ngrok

DOMAIN="${1:-${NGROK_DOMAIN:-}}"
if [ -z "$DOMAIN" ]; then
  echo "Usage: bash deploy/start-ngrok.sh <your-domain.ngrok-free.app>"
  exit 1
fi
URL="https://${DOMAIN}"

# Point the backend at the public origin so OAuth redirects, invite links, and
# absolute file URLs resolve correctly. Front is same-origin via the Vite proxy.
SERVER_ENV="$REPO_ROOT/packages/twenty-server/.env"
set_kv() {
  local key="$1" val="$2" file="$3"
  if grep -qE "^${key}=" "$file"; then
    sed -i '' "s|^${key}=.*|${key}=${val}|" "$file"
  else
    printf '%s=%s\n' "$key" "$val" >> "$file"
  fi
}
set_kv FRONTEND_URL "$URL" "$SERVER_ENV"
set_kv SERVER_URL "$URL" "$SERVER_ENV"

echo "Backend env set to $URL (restart 'yarn start' if it was already running)."
echo "Starting ngrok -> http://localhost:3001 on $DOMAIN ..."
exec "$NGROK" http "--url=${URL}" 3001
