#!/bin/bash
# Download only from the approved private scrubbed-mirror store.
set -euo pipefail
set +x
umask 077
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${TWENTY_DEVDATA_CONFIG:-$HOME/.config/twenty-devdata/r2.env}"
if [ ! -f "$CONFIG" ]; then
  echo '[devdata-download] Missing scrubbed-mirror configuration. See deploy/DEVELOPMENT.md.' >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "$CONFIG"
set +a
exec python3 "$REPO_ROOT/deploy/devdata/download.py" "$@"
