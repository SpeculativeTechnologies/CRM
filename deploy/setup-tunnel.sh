#!/bin/bash
# =============================================================================
# Cloudflare Tunnel bring-up for crm.spec.tech  ->  this Mac (Twenty dev)
# =============================================================================
# Prereqs (one-time, done by YOU in a browser/registrar — see deploy/LOCAL-DEV.md):
#   1. Add spec.tech as a site in your Cloudflare account.
#   2. At your registrar, change spec.tech nameservers to the two Cloudflare
#      nameservers Cloudflare shows you. Wait until Cloudflare marks it "Active".
#   3. Authenticate cloudflared (opens a browser, pick the spec.tech zone):
#        cloudflared tunnel login
#
# Then run this script:  bash deploy/setup-tunnel.sh
# It is idempotent — safe to re-run.
# =============================================================================
set -euo pipefail

TUNNEL_NAME="twenty-crm"
APEX="spec.tech"
FRONT_HOST="crm.spec.tech"
API_HOST="api.crm.spec.tech"
CF_DIR="$HOME/.cloudflared"
CONFIG="$CF_DIR/config.yml"

command -v cloudflared >/dev/null || { echo "cloudflared not installed"; exit 1; }
[ -f "$CF_DIR/cert.pem" ] || { echo "Not logged in. Run: cloudflared tunnel login"; exit 1; }

# Create tunnel if it doesn't exist, capture its UUID
if ! cloudflared tunnel list 2>/dev/null | grep -q " $TUNNEL_NAME "; then
  echo "Creating tunnel $TUNNEL_NAME..."
  cloudflared tunnel create "$TUNNEL_NAME"
fi
TUNNEL_ID="$(cloudflared tunnel list --output json | python3 -c 'import sys,json;[print(t["id"]) for t in json.load(sys.stdin) if t["name"]=="'"$TUNNEL_NAME"'"]')"
echo "Tunnel ID: $TUNNEL_ID"

# Write ingress config: front host -> vite:3001, api host -> server:3000
cat > "$CONFIG" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $CF_DIR/$TUNNEL_ID.json

ingress:
  - hostname: $FRONT_HOST
    service: http://localhost:3001
  - hostname: $API_HOST
    service: http://localhost:3000
  - service: http_status:404
EOF
echo "Wrote $CONFIG"

# Create the public-hostname DNS (CNAME -> tunnel) in the Cloudflare zone
cloudflared tunnel route dns "$TUNNEL_NAME" "$FRONT_HOST" || true
cloudflared tunnel route dns "$TUNNEL_NAME" "$API_HOST"   || true

echo
echo "Validating config..."
cloudflared tunnel ingress validate

echo
echo "Done. Start the tunnel as a background service with:"
echo "    sudo cloudflared service install   # installs launchd using $CONFIG"
echo "    sudo launchctl start com.cloudflare.cloudflared"
echo "Or run in the foreground to test first:"
echo "    cloudflared tunnel run $TUNNEL_NAME"
