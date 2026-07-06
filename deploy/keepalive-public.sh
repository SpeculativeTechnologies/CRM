#!/bin/bash
# Local stand-in for launchd KeepAlive: restart serve-public.sh whenever it
# exits (it self-exits when any child dies). Ignores hangup/term/int so the
# supervising loop survives signals from the controlling session.
trap '' HUP
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
while true; do
  bash "$REPO_ROOT/deploy/serve-public.sh" >> /tmp/twenty-public.log 2>&1
  echo "[keepalive] serve-public exited; restarting $(date)" >> /tmp/twenty-public.log
  sleep 3
done
