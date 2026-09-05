#!/bin/bash
# =============================================================================
# Verify a cloud box after a deploy: the CRM works, not just the health check.
# =============================================================================
# Runs on the box, fed over IAP by cd-deploy-cloud after cloud-deploy.sh. The
# script arrives on stdin, so every docker command that could read stdin gets
# </dev/null or it swallows the rest of the script:
#
#   gcloud compute ssh <vm> --tunnel-through-iap --command 'bash -s' \
#     < deploy/cloud-verify.sh
#
# Every check here is an invariant that was false on staging or production
# during the 2026-09-03/04 deploys while the health check was green:
#   - the deployed image is the one asked for, and all containers run;
#   - every workspace's upgrade cursor is on the last workspace step and the
#     deployed image has nothing left to catch up (so no command was skipped);
#   - object navigation command menu items carry a target, not a legacy
#     payload the 2.38 API hides (broken left navigation otherwise);
#   - no command menu item label is still a pre-2.33 template expression
#     (the 2.38 UI shows it raw, e.g. "New ${capitalize(...)}");
#   - timelineActivity has its search column and search metadata (search over
#     the timeline is dead otherwise);
#   - the server log has no errors since it started.
#
# Prints structural facts only: counts, command names, workspace id prefixes.
# Never record data. Exit code non-zero on any failed check.
# =============================================================================
set -uo pipefail

EXPECTED_SHA="${EXPECTED_SHA:-}"
COMPOSE_DIR=/opt/twenty
ENV_FILE="$COMPOSE_DIR/.env.cloud"
COMPOSE_FILE="$COMPOSE_DIR/compose.cloud.yml"

FAILURES=0
pass() { echo "[verify] ok    $*"; }
fail() { echo "[verify] FAIL  $*"; FAILURES=$((FAILURES + 1)); }

[ "$(id -u)" -eq 0 ] || { echo "[verify] run as root (sudo)"; exit 1; }
cd "$COMPOSE_DIR" || exit 1
compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
sql() { docker exec "$DB" psql -U postgres -d twenty -At -c "$1"; }

# --- image and containers ----------------------------------------------------
RUNNING_IMAGE="$(grep -E '^CLOUD_IMAGE=' "$ENV_FILE" | cut -d= -f2-)"
if [ -n "$EXPECTED_SHA" ]; then
  case "$RUNNING_IMAGE" in
    *:"$EXPECTED_SHA") pass "image is $EXPECTED_SHA" ;;
    *) fail "image is $RUNNING_IMAGE, expected sha $EXPECTED_SHA (rolled back?)" ;;
  esac
fi

NOT_RUNNING="$(compose ps --format '{{.Service}} {{.State}}' | grep -v ' running$' || true)"
if [ -z "$NOT_RUNNING" ]; then
  pass "all containers running"
else
  fail "containers not running: $(echo "$NOT_RUNNING" | tr '\n' ' ')"
fi

if compose exec -T server curl -sf localhost:3000/healthz </dev/null >/dev/null 2>&1; then
  pass "healthz answers"
else
  fail "healthz does not answer"
fi

DB="$(compose ps -q db)"
[ -n "$DB" ] || { echo "[verify] no db container"; exit 1; }

# --- upgrade bookkeeping -----------------------------------------------------
# The deployed image plans its own upgrade; anything left means a step was
# skipped or failed. Dry run executes nothing since fork PR #224.
DRY_RUN="$(compose run --rm --no-deps --entrypoint sh server -c \
  'cd /app/packages/twenty-server && node dist/command/command.js upgrade --dry-run' 2>&1 </dev/null \
  | sed 's/\x1b\[[0-9;]*m//g')"
CATCH_UP_LEFT="$(echo "$DRY_RUN" | grep -c 'event=workspace.catch-up ' || true)"
INSTANCE_LEFT="$(echo "$DRY_RUN" | grep -c 'event=instance\.' || true)"
SUMMARY="$(echo "$DRY_RUN" | grep -o 'Upgrade summary: .*' | head -1)"
if [ "$CATCH_UP_LEFT" = "0" ] && [ "$INSTANCE_LEFT" = "0" ] && echo "$SUMMARY" | grep -q ' 0 workspace(s) failed'; then
  pass "upgrade fully applied ($SUMMARY)"
else
  fail "upgrade not fully applied: $CATCH_UP_LEFT catch-up step(s) and $INSTANCE_LEFT instance step(s) still planned; $SUMMARY"
  echo "$DRY_RUN" | grep -E 'event=workspace.catch-up |event=instance\.|ERROR' | sed 's/.*step=//; s/ workspaceId=.*//' | sort -u | sed 's/^/[verify]        /'
fi

FAILED_CURSORS="$(sql "SELECT count(*) FROM (SELECT DISTINCT ON (\"workspaceId\") status FROM (SELECT DISTINCT ON (\"workspaceId\", name) * FROM core.\"upgradeMigration\" WHERE \"workspaceId\" IS NOT NULL ORDER BY \"workspaceId\", name, attempt DESC) l ORDER BY \"workspaceId\", \"createdAt\" DESC) c WHERE status <> 'completed';")"
if [ "$FAILED_CURSORS" = "0" ]; then
  pass "every workspace cursor is completed"
else
  fail "$FAILED_CURSORS workspace cursor(s) sit on a failed step"
fi

# --- navigation command menu items -------------------------------------------
LEGACY_OBJECT_NAV="$(sql "SELECT count(*) FROM core.\"commandMenuItem\" WHERE \"engineComponentKey\" = 'NAVIGATION' AND \"navigationTargetObjectMetadataId\" IS NULL AND payload ? 'objectMetadataItemId';")"
if [ "$LEGACY_OBJECT_NAV" = "0" ]; then
  pass "no object navigation item in the legacy payload shape"
else
  fail "$LEGACY_OBJECT_NAV object navigation item(s) still carry a payload instead of a target (hidden by the API)"
fi

EMPTY_NAV="$(sql "SELECT count(*) FROM core.\"commandMenuItem\" WHERE \"engineComponentKey\" = 'NAVIGATION' AND \"navigationTargetObjectMetadataId\" IS NULL AND payload IS NULL;")"
if [ "$EMPTY_NAV" = "0" ]; then
  pass "no navigation item without target or payload"
else
  fail "$EMPTY_NAV navigation item(s) have neither target nor payload"
fi

TEMPLATE_LABELS="$(sql "SELECT count(*) FROM core.\"commandMenuItem\" WHERE label LIKE '%\${%' OR \"shortLabel\" LIKE '%\${%' OR icon LIKE '%\${%';")"
if [ "$TEMPLATE_LABELS" = "0" ]; then
  pass "no command menu item label still stored as a template expression"
else
  fail "$TEMPLATE_LABELS command menu item(s) still carry a pre-2.33 template label (shows as raw \${...} in the UI)"
fi

# --- timeline search ---------------------------------------------------------
WORKSPACE_COUNT="$(sql "SELECT count(*) FROM core.workspace WHERE \"activationStatus\" IN ('ACTIVE','SUSPENDED') AND \"databaseSchema\" IS NOT NULL;")"
SEARCH_COLUMNS="$(sql "SELECT count(*) FROM information_schema.columns c JOIN core.workspace w ON w.\"databaseSchema\" = c.table_schema WHERE c.table_name = 'timelineActivity' AND c.column_name = 'searchVector';")"
SEARCH_ROWS="$(sql "SELECT count(*) FROM core.\"searchFieldMetadata\" s JOIN core.\"objectMetadata\" o ON o.id = s.\"objectMetadataId\" WHERE o.\"nameSingular\" = 'timelineActivity';")"
if [ "$SEARCH_COLUMNS" = "$WORKSPACE_COUNT" ] && [ "$SEARCH_ROWS" = "$WORKSPACE_COUNT" ]; then
  pass "timelineActivity search column and metadata present in all $WORKSPACE_COUNT workspace(s)"
else
  fail "timelineActivity search: $SEARCH_COLUMNS column(s) and $SEARCH_ROWS metadata row(s) for $WORKSPACE_COUNT workspace(s)"
fi

# --- server log --------------------------------------------------------------
SERVER_ERRORS="$(compose logs --since 10m server 2>/dev/null | grep -c -E '\bERROR\b' || true)"
if [ "$SERVER_ERRORS" = "0" ]; then
  pass "no ERROR in the server log for the last 10 minutes"
else
  fail "$SERVER_ERRORS ERROR line(s) in the server log for the last 10 minutes"
  compose logs --since 10m server 2>/dev/null | grep -E '\bERROR\b' | sed 's/\x1b\[[0-9;]*m//g' | cut -c1-200 | tail -5 | sed 's/^/[verify]        /'
fi

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "[verify] OK  all checks passed"
else
  echo "[verify] FAIL  $FAILURES check(s) failed"
  exit 1
fi
