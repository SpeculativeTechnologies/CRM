#!/bin/bash
# =============================================================================
# Weekly upstream sync: open a PR bringing twentyhq/twenty main into the fork.
# =============================================================================
# Runs from .github/workflows/sync-upstream.yaml (Mondays, or on demand) and
# can also be run by hand from any clone. It NEVER merges into main itself: a
# PR is opened and CI Fork runs on it. With the SYNC_UPSTREAM_AUTOMERGE repo
# variable set to "true", a PR whose conflicts were all mechanical is queued
# for auto-merge once CI is green; a PR the agent had to resolve is never
# auto-merged.
#
#   bash deploy/sync-upstream.sh                 # full run (merge, resolve, PR)
#   bash deploy/sync-upstream.sh run             # same, explicit
#   bash deploy/sync-upstream.sh finish <kind>   # CI only: commit, regenerate, push, PR
#   bash deploy/sync-upstream.sh report-conflict # CI only: file the conflict issue
#
# Outside CI the merge happens in a throwaway worktree and the checkout the
# script lives in is never touched. In CI (GITHUB_ACTIONS=true) it works in
# place so that a later step can hand unresolved conflicts to the agent, and
# `run` stops after the merge; the workflow calls `finish` itself.
#
# Design rule after the 2026-07-27 silent failure: a run that does not open a
# PR must be LOUD. Every early exit below is either "nothing to do" or a
# reported failure; a broken `gh` call must never be mistaken for either.
#
# Resolution policy lives in deploy/UPSTREAM-SYNC.md. Keep the two in sync.
# =============================================================================
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

REPO="SpeculativeTechnologies/CRM"
HTTPS_URL="https://github.com/$REPO.git"
UPSTREAM_URL="https://github.com/twentyhq/twenty.git"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALERT_FILE="${SYNC_UPSTREAM_ALERT_FILE:-$HOME/Backups/twenty/sync-upstream-CONFLICT.md}"
IN_CI="${GITHUB_ACTIONS:-false}"
STATE_DIR="${SYNC_UPSTREAM_STATE_DIR:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/sync-upstream-state}"
REGENERATE="${SYNC_UPSTREAM_REGENERATE:-$IN_CI}"
AUTOMERGE="${SYNC_UPSTREAM_AUTOMERGE:-false}"
SERVER_URL="${SYNC_UPSTREAM_SERVER_URL:-}"
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-$REPO}/actions/runs/${GITHUB_RUN_ID:-}"
PLAYBOOK="deploy/UPSTREAM-SYNC.md"
TODAY="$(date +%Y-%m-%d)"
mkdir -p "$STATE_DIR"

log() { echo "[sync-upstream] $*"; }

# Step outputs for the workflow; a plain log line everywhere else.
emit() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "$1=$2" >> "$GITHUB_OUTPUT"
  fi
  log "$1=$2"
}

# Push over https with gh's token — cron and CI have no ssh key.
push_branch() {
  git -c credential.helper= -c 'credential.helper=!gh auth git-credential' \
    push --no-follow-tags "$HTTPS_URL" "$1"
}

# Best-effort desktop notification (no-op when headless).
notify() {
  command -v osascript >/dev/null 2>&1 || return 0
  osascript -e "display notification \"$1\" with title \"Twenty upstream sync\"" \
    >/dev/null 2>&1 || true
}

# Count rows from a gh query. Echoes an integer on success; on ANY failure
# echoes nothing and returns 1 — callers must treat that as "unknown".
gh_count() {
  local out
  out="$(gh "$@" 2>/dev/null)" || return 1
  [[ "$out" =~ ^[0-9]+$ ]] || return 1
  echo "$out"
}

# Locale catalogs, generated GraphQL types and jest snapshots conflict on
# nearly every sync and are always resolved the same way: take upstream, then
# regenerate. `finish` does the regeneration.
MECHANICAL_PATHS=(
  'packages/twenty-front/src/locales'
  'packages/twenty-server/src/engine/core-modules/i18n/locales'
  'packages/twenty-emails/src/locales'
  'packages/twenty-front/src/generated/graphql.ts'
  'packages/twenty-front/src/generated-metadata/graphql.ts'
  'packages/twenty-front/src/generated-admin/graphql.ts'
  '*__snapshots__*'
  '*.snap'
)

# Hundreds of back-to-back index writes can trip over a not-yet-released
# index.lock on macOS; retry instead of misclassifying the failure.
run_with_retry() {
  local attempt
  for attempt in 1 2 3; do
    "$@" 2>/dev/null && return 0
    sleep 1
  done
  return 1
}

resolve_mechanical_conflicts() {
  : > "$STATE_DIR/snapshots.txt"
  : > "$STATE_DIR/graphql.txt"
  local conflicted_file
  while IFS= read -r conflicted_file; do
    case "$conflicted_file" in
      *.snap) echo "$conflicted_file" >> "$STATE_DIR/snapshots.txt" ;;
      packages/twenty-front/src/generated*/graphql.ts) echo "$conflicted_file" >> "$STATE_DIR/graphql.txt" ;;
    esac
    if [ -n "$(git ls-files -u -- "$conflicted_file" | awk '$3 == 3')" ]; then
      run_with_retry git checkout --theirs -- "$conflicted_file" &&
        run_with_retry git add -- "$conflicted_file"
    else
      # No stage 3: upstream deleted the file; taking upstream means git rm.
      run_with_retry git rm -q -- "$conflicted_file"
    fi
  done < <(git diff --name-only --diff-filter=U -- "${MECHANICAL_PATHS[@]}")
}

# Conflict issue: comment on an open one rather than staying silent (the
# 2026-08-24 run was muted by a stale issue), else open a new one, else fall
# back to a file plus a notification. Never silent.
report_conflict() {
  local behind conflicts body
  behind="$(cat "$STATE_DIR/behind" 2>/dev/null || echo '?')"
  conflicts="$(cat "$STATE_DIR/conflicts.txt" 2>/dev/null || echo '(list unavailable)')"

  body="$(printf 'Weekly upstream sync could not merge twentyhq/twenty main (%s commits behind) and the automated resolution did not finish — manual merge needed:\n\n```\ngit fetch upstream && git switch -c sync/upstream-manual main && git -c merge.ours.driver=true merge upstream/main\n```\n\nReal code conflicts (locale catalogs, generated GraphQL types and jest snapshots are excluded; take upstream for those and regenerate):\n```\n%s\n```\n\nResolution policy: `%s`. Run: %s\n' \
    "$behind" "$conflicts" "$PLAYBOOK" "$RUN_URL")"

  local open_issue_number
  open_issue_number="$(gh issue list -R "$REPO" --state open \
    --search 'Upstream sync conflict in:title' \
    --json number --jq '.[0].number // empty' 2>/dev/null)"
  if [[ "$open_issue_number" =~ ^[0-9]+$ ]]; then
    if gh issue comment "$open_issue_number" -R "$REPO" \
         --body "$(printf 'New conflict on the %s run (this issue is from an earlier week — it closes when a sync PR opens).\n\n%s' "$TODAY" "$body")" \
         >/dev/null 2>&1; then
      log "CONFLICT: commented on already-open issue #$open_issue_number"
      return 0
    fi
    log "CONFLICT: issue #$open_issue_number is open but commenting failed — trying a new issue"
  fi

  if gh issue create -R "$REPO" \
       --title "Upstream sync conflict ($TODAY)" \
       --body "$body" >/dev/null 2>&1; then
    log "CONFLICT: issue opened"
    return 0
  fi

  log "CONFLICT: could NOT open a GitHub issue (issues disabled on $REPO, or gh failed)"
  if printf '%s\n' "$body" > "$ALERT_FILE" 2>/dev/null; then
    log "CONFLICT: wrote $ALERT_FILE"
  else
    log "CONFLICT: could not write $ALERT_FILE either — this log is the only record"
  fi
  notify "Upstream merge conflicted; see $ALERT_FILE"
}

# Every open conflict issue is answered by the PR that finally syncs, so close
# them here instead of relying on someone remembering to (nobody did in August).
close_conflict_issues() {
  local pr_url="$1" number
  while IFS= read -r number; do
    [[ "$number" =~ ^[0-9]+$ ]] || continue
    gh issue close "$number" -R "$REPO" \
      --comment "Superseded by the sync PR $pr_url." >/dev/null 2>&1 &&
      log "closed conflict issue #$number"
  done < <(gh issue list -R "$REPO" --state open \
    --search 'Upstream sync conflict in:title' --json number --jq '.[].number' 2>/dev/null)
}

# Spec file that owns a snapshot: dir/__snapshots__/x.spec.ts.snap -> dir/x.spec.ts
spec_for_snapshot() {
  local snap="$1" dir base
  dir="$(dirname "$(dirname "$snap")")"
  base="$(basename "$snap" .snap)"
  [ -f "$dir/$base" ] && echo "$dir/$base"
}

regenerate() {
  local notes="$STATE_DIR/regeneration.md"
  : > "$notes"
  log "regenerating catalogs, snapshots and generated types"

  yarn install >/dev/null 2>&1 || { echo "- yarn install FAILED" >> "$notes"; log "WARN: yarn install failed"; }
  npx nx run-many -t build -p twenty-shared twenty-ui >/dev/null 2>&1 ||
    echo "- twenty-shared/twenty-ui build FAILED; snapshot re-recording may be wrong" >> "$notes"

  # Straight from each package: the nx target also runs the component-renderer
  # sandbox prebuild, which needs an SDK build the runner may not have.
  local project
  for project in twenty-front twenty-server twenty-emails; do
    if (cd "packages/$project" && npx lingui extract >/dev/null 2>&1 &&
        npx lingui compile >/dev/null 2>&1); then
      echo "- $project message catalogs re-extracted and compiled" >> "$notes"
    else
      echo "- $project lingui extract/compile FAILED" >> "$notes"
    fi
  done

  local snap spec pkg rel
  while IFS= read -r snap; do
    [ -n "$snap" ] || continue
    spec="$(spec_for_snapshot "$snap")"
    if [ -z "$spec" ]; then
      echo "- $snap taken from upstream; no owning spec found, review by hand" >> "$notes"
      continue
    fi
    pkg="$(echo "$spec" | cut -d/ -f1-2)"
    rel="${spec#"$pkg"/}"
    if (cd "$pkg" && npx jest "$rel" -u >/dev/null 2>&1); then
      echo "- re-recorded \`$snap\` from \`$spec\`" >> "$notes"
    else
      echo "- \`$spec\` FAILED while re-recording \`$snap\`; fix before merging" >> "$notes"
    fi
  done < "$STATE_DIR/snapshots.txt"

  if [ -s "$STATE_DIR/graphql.txt" ]; then
    if [ -n "$SERVER_URL" ]; then
      local ok=true configuration
      for configuration in '' metadata admin; do
        REACT_APP_SERVER_BASE_URL="$SERVER_URL" npx nx run twenty-front:graphql:generate ${configuration:+--configuration=$configuration} >/dev/null 2>&1 || ok=false
      done
      if $ok; then
        echo "- GraphQL types regenerated against a server built from this branch" >> "$notes"
      else
        echo "- GraphQL codegen FAILED; the generated types are upstream's and miss fork fields until regenerated" >> "$notes"
      fi
    else
      echo "- generated GraphQL types were taken from upstream and NOT regenerated (no server available); run \`npx nx run twenty-front:graphql:generate --configuration=metadata\` against a dev server and commit" >> "$notes"
    fi
  fi

  git add -A
  if ! git diff --cached --quiet; then
    git -c user.name="sync-upstream" -c user.email="sync-upstream@localhost" \
      commit -q -m "Regenerate catalogs, snapshots and generated types after upstream merge"
    log "regeneration committed"
  else
    echo "- nothing needed regenerating" >> "$notes"
  fi
}

pr_body() {
  local kind="$1" behind="$2" schema_changes regen agent_notes conflicts
  schema_changes="$(git diff --name-only origin/main...upstream/main -- \
    'packages/twenty-server/src/database' '**/*.entity.ts' 2>/dev/null | head -20)"
  regen="$(cat "$STATE_DIR/regeneration.md" 2>/dev/null)"
  agent_notes="$(cat "$STATE_DIR/agent-notes.md" 2>/dev/null)"
  conflicts="$(cat "$STATE_DIR/conflicts.txt" 2>/dev/null)"

  printf 'Automated weekly upstream sync: %s upstream commits from twentyhq/twenty main.\n\n' "$behind"
  case "$kind" in
    clean)
      printf 'Merged cleanly, no conflicts.\n\n' ;;
    mechanical)
      printf 'Only locale catalogs, generated GraphQL types and jest snapshots conflicted. They were resolved by taking upstream and regenerating.\n\n' ;;
    agent)
      printf '**Real code conflicts were resolved by the sync agent.** Review these files before merging; their fork-side intent is described in the notes below.\n\n```\n%s\n```\n\n' "$conflicts"
      if [ -n "$agent_notes" ]; then printf '### Agent notes\n\n%s\n\n' "$agent_notes"; fi ;;
  esac
  if [ -n "$regen" ]; then printf '### Regeneration\n\n%s\n\n' "$regen"; fi
  if [ -n "$schema_changes" ]; then
    printf '**Schema/migration files changed upstream** — a DB change rides along and needs the staging check before promotion:\n```\n%s\n```\n\n' "$schema_changes"
  else
    printf 'No schema/migration changes detected upstream.\n\n'
  fi
  printf 'Policy: `%s`. Run: %s\n' "$PLAYBOOK" "$RUN_URL"
}

# Commit the merge if still open, regenerate derived files, push, open the PR.
finish() {
  local kind="$1" behind branch pr_url title
  behind="$(cat "$STATE_DIR/behind")"
  branch="$(cat "$STATE_DIR/branch")"

  if git rev-parse -q --verify MERGE_HEAD >/dev/null; then
    if [ -n "$(git diff --name-only --diff-filter=U)" ] ||
       git grep -q -l -E '^(<<<<<<< |>>>>>>> )' -- ':!*.snap' ':!*.po' ':!deploy/UPSTREAM-SYNC.md' 2>/dev/null; then
      log "FAIL: conflict markers remain; not committing"
      git diff --name-only --diff-filter=U
      git grep -l -E '^(<<<<<<< |>>>>>>> )' -- ':!*.snap' ':!*.po' ':!deploy/UPSTREAM-SYNC.md' 2>/dev/null || true
      return 2
    fi
    git add -A
    if ! git -c user.name="sync-upstream" -c user.email="sync-upstream@localhost" \
         commit -q -m "Merge upstream twentyhq/twenty main ($TODAY, $behind commits)"; then
      log "FAIL: could not commit the merge"
      return 1
    fi
  fi

  if [ "$REGENERATE" = "true" ]; then
    regenerate
  else
    printf -- '- regeneration skipped (SYNC_UPSTREAM_REGENERATE=%s); run lingui extract/compile, re-record conflicted snapshots and GraphQL codegen before merging\n' "$REGENERATE" > "$STATE_DIR/regeneration.md"
  fi

  if ! push_branch "$branch"; then
    log "FAIL: could not push $branch (does the token have contents:write?)"
    notify "Upstream sync merged but the push failed"
    return 1
  fi

  gh label create upstream-sync -R "$REPO" -c '#0e8a16' \
    -d 'Weekly merge from twentyhq/twenty' --force >/dev/null 2>&1 || true

  case "$kind" in
    clean) title="Sync upstream twentyhq/twenty ($behind commits)" ;;
    mechanical) title="Sync upstream twentyhq/twenty ($behind commits, regenerated)" ;;
    *) title="Sync upstream twentyhq/twenty ($behind commits, conflicts resolved by agent)" ;;
  esac

  if ! pr_url="$(gh pr create -R "$REPO" --base main --head "$branch" \
        --label upstream-sync --title "$title" --body "$(pr_body "$kind" "$behind")")"; then
    log "FAIL: pushed $branch but could not open the PR — open it by hand"
    notify "Upstream sync branch pushed but the PR was not created"
    return 1
  fi
  log "OK: PR opened $pr_url ($kind, $behind commits)"
  emit pr_url "$pr_url"
  close_conflict_issues "$pr_url"

  if [ "$AUTOMERGE" = "true" ] && [ "$kind" != "agent" ]; then
    if gh pr merge "$pr_url" -R "$REPO" --auto --merge >/dev/null 2>&1; then
      log "auto-merge queued; GitHub merges when CI Fork is green"
      emit automerge queued
    else
      log "WARN: could not queue auto-merge (is 'Allow auto-merge' on and the token allowed to merge?)"
      emit automerge failed
    fi
  fi
  emit outcome pr
}

run() {
  log "$(date) fetching..."
  cd "$REPO_ROOT"
  git remote get-url upstream >/dev/null 2>&1 || git remote add upstream "$UPSTREAM_URL"
  git fetch --quiet origin main
  git fetch --quiet upstream main

  if [ "$(gh api "repos/$REPO" --jq .has_issues 2>/dev/null)" != "true" ]; then
    log "WARNING: issues are disabled on $REPO — conflicts will fall back to $ALERT_FILE"
  fi

  if git merge-base --is-ancestor upstream/main origin/main; then
    log "fork already contains upstream/main — nothing to do"
    emit outcome noop
    exit 0
  fi

  local open_sync_prs
  open_sync_prs="$(gh_count pr list -R "$REPO" --state open --json headRefName \
    --jq '[.[] | select(.headRefName | startswith("sync/upstream"))] | length')"
  if [ -z "$open_sync_prs" ]; then
    log "FAIL: could not list open PRs on $REPO — aborting rather than risk a duplicate"
    notify "Could not reach GitHub to check for an open sync PR"
    exit 1
  fi
  if [ "$open_sync_prs" -gt 0 ]; then
    log "an open sync PR already exists — merge or close it first"
    emit outcome noop
    exit 0
  fi

  local behind branch
  behind="$(git rev-list --count origin/main..upstream/main)"
  branch="sync/upstream-$TODAY"
  echo "$behind" > "$STATE_DIR/behind"
  echo "$branch" > "$STATE_DIR/branch"
  emit behind "$behind"
  emit branch "$branch"

  if [ "$IN_CI" = "true" ]; then
    git switch --quiet -c "$branch" origin/main
  else
    local worktree
    worktree="$(mktemp -d)/sync"
    git worktree add --quiet --detach "$worktree" origin/main
    cleanup() {
      cd "$REPO_ROOT"
      git worktree remove --force "$worktree" 2>/dev/null
      git branch -D "$branch" 2>/dev/null
    }
    trap cleanup EXIT
    cd "$worktree"
    git switch --quiet -c "$branch"
  fi

  # merge.ours.driver enables the `merge=ours` attributes (the fork's file
  # always wins); the union attributes in .gitattributes need no config.
  local kind
  if git -c merge.ours.driver=true merge --no-edit upstream/main >/dev/null 2>&1; then
    kind=clean
    : > "$STATE_DIR/snapshots.txt"
    : > "$STATE_DIR/graphql.txt"
  else
    resolve_mechanical_conflicts
    local remaining
    remaining="$(git diff --name-only --diff-filter=U)"
    if [ -n "$remaining" ]; then
      printf '%s\n' "$remaining" > "$STATE_DIR/conflicts.txt"
      emit conflicts "$(printf '%s\n' "$remaining" | wc -l | tr -d ' ')"
      if [ "$IN_CI" = "true" ]; then
        # Leave the merge open for the agent step; the workflow decides.
        log "CONFLICT: $(printf '%s\n' "$remaining" | wc -l | tr -d ' ') files need a real resolution"
        printf '%s\n' "$remaining"
        emit outcome conflict
        exit 0
      fi
      git merge --abort 2>/dev/null
      report_conflict
      exit 1
    fi
    kind=mechanical
    if ! git -c user.name="sync-upstream" -c user.email="sync-upstream@localhost" \
         commit --no-edit -q; then
      log "FAIL: could not commit the mechanically resolved merge"
      notify "Upstream sync auto-resolution failed to commit"
      exit 1
    fi
  fi

  emit regenerate_graphql "$([ -s "$STATE_DIR/graphql.txt" ] && echo true || echo false)"
  if [ "$IN_CI" = "true" ]; then
    emit outcome "$kind"
    exit 0
  fi
  finish "$kind"
}

case "${1:-run}" in
  run) run ;;
  finish) cd "$REPO_ROOT" && finish "${2:?kind: clean|mechanical|agent}" ;;
  report-conflict) cd "$REPO_ROOT" && report_conflict ;;
  *) echo "usage: $0 [run|finish <kind>|report-conflict]" >&2; exit 64 ;;
esac
