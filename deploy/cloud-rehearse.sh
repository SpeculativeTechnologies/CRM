#!/bin/bash
# =============================================================================
# Rehearse an upgrade on a cloud box without changing it.
# =============================================================================
# Runs on the box, fed over IAP by cd-deploy-cloud before the real deploy:
#
#   gcloud compute ssh <vm> --tunnel-through-iap --command 'bash -s' \
#     < deploy/cloud-rehearse.sh   (with IMAGE_SHA in the environment via
#                                   `IMAGE_SHA=<sha> bash -s`, see the workflow)
#
# It pulls the target image and runs `upgrade --dry-run` from it against the
# box's real database. Since fork PR #224 a dry run executes nothing: instance
# steps, caught-up workspace steps and the segment ahead all print their plan.
# That plan is what predicted every failure of the 2026-09-03 staging deploys;
# nobody had run it. Exit code is non-zero when the dry run reports an error
# or a failed workspace, so the deploy stops before touching anything.
#
# Output: the filtered dry-run log on stdout, and a short summary at the end.
# It prints command names and workspace ids only, never record data.
# =============================================================================
set -euo pipefail

IMAGE_SHA="${IMAGE_SHA:-}"
COMPOSE_DIR=/opt/twenty
ENV_FILE="$COMPOSE_DIR/.env.cloud"
COMPOSE_FILE="$COMPOSE_DIR/compose.cloud.yml"
IMAGE_REPO="${CLOUD_IMAGE_REPO:-ghcr.io/speculativetechnologies/twenty}"
# The migration container inherits the app's 10 s query timeout by default;
# a dry run only reads, but a large workspace can still exceed it.
QUERY_TIMEOUT_MS="${CLOUD_MIGRATION_QUERY_TIMEOUT_MS:-1800000}"

log() { echo "[rehearse] $*"; }
fail() { echo "[rehearse] FAIL: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "run as root (sudo)"
[[ "$IMAGE_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "IMAGE_SHA must be a 40-character commit sha, got '$IMAGE_SHA'"
[ -f "$ENV_FILE" ] || fail "$ENV_FILE missing"

cd "$COMPOSE_DIR"
TARGET="$IMAGE_REPO:$IMAGE_SHA"

log "pulling $TARGET"
docker pull --quiet "$TARGET" >/dev/null || fail "cannot pull $TARGET"

log "dry-running upgrade from $TARGET against this box"
OUTPUT="$(mktemp)"
trap 'rm -f "$OUTPUT"' EXIT

set +e
CLOUD_IMAGE="$TARGET" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
  run --rm --no-deps -e "PG_DATABASE_PRIMARY_TIMEOUT_MS=$QUERY_TIMEOUT_MS" \
  --entrypoint sh server -c \
  'cd /app/packages/twenty-server && node dist/command/command.js upgrade --dry-run' \
  > "$OUTPUT" 2>&1 </dev/null
STATUS=$?
set -e

# Strip ANSI colour and the boot noise; keep every line that says what would run.
sed 's/\x1b\[[0-9;]*m//g' "$OUTPUT" \
  | grep -v -E 'EntityBuilder|install-perf|InstanceLoader|dependencies initialized|Registered [0-9]+ fast|WorkspaceCacheMemReport|BullMQ' \
  | grep -E 'DRY RUN|Would|catch-up|ERROR|Error|WARN|Upgrade summary|sequence\.' || true

echo
CATCH_UP_COUNT="$(grep -c 'event=workspace.catch-up ' "$OUTPUT" || true)"
SKIPPED_LINE="$(sed 's/\x1b\[[0-9;]*m//g' "$OUTPUT" | grep -m1 -o '[0-9]* workspace step(s) below [0-9.]* never completed' || true)"
SUMMARY_LINE="$(sed 's/\x1b\[[0-9;]*m//g' "$OUTPUT" | grep -o 'Upgrade summary: .*' | head -1 || true)"

log "catch-up steps planned: ${CATCH_UP_COUNT}"
[ -n "$SKIPPED_LINE" ] && log "left alone below the floor: ${SKIPPED_LINE}"
log "${SUMMARY_LINE:-no upgrade summary printed}"

if [ "$STATUS" -ne 0 ]; then
  fail "dry run exited with status $STATUS"
fi
if grep -q -E 'ERROR|workspace\(s\) failed' <(sed 's/\x1b\[[0-9;]*m//g' "$OUTPUT" | grep -v '0 workspace(s) failed'); then
  fail "dry run reported an error; read the plan above before deploying"
fi

log "OK  the upgrade plan for $IMAGE_SHA is clean"
