#!/bin/bash
# =============================================================================
# Weekly upstream sync: open a PR bringing twentyhq/twenty main into the fork.
# =============================================================================
# NEVER merges automatically. Upstream main is a fast-moving dev branch and our
# main deploys to the live CRM, so a human reviews/merges the PR (CI Fork runs
# on it like any other PR). If the merge conflicts with our custom commits,
# this reports the conflicting files instead — see report_conflict() for the
# channels it tries, in order.
#
# Runs weekly via cron from the deploy clone (see crontab -l). Run by hand:
#   bash deploy/sync-upstream.sh
# Merge work happens in a throwaway git worktree — the checkout this script
# lives in is never touched, so it's safe to run next to the live stack.
#
# Design rule after the 2026-07-27 silent failure: a run that does not open a
# PR must be LOUD. Every early exit below is either "nothing to do" or a
# reported failure; a broken `gh` call must never be mistaken for either.
# =============================================================================
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

REPO="SpeculativeTechnologies/CRM"
HTTPS_URL="https://github.com/$REPO.git"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALERT_FILE="${SYNC_UPSTREAM_ALERT_FILE:-$HOME/Backups/twenty/sync-upstream-CONFLICT.md}"
cd "$REPO_ROOT"

log() { echo "[sync-upstream] $*"; }

# Push over https with gh's token — cron has no ssh-agent/keychain.
push_branch() {
  git -c credential.helper= -c 'credential.helper=!gh auth git-credential' \
    push --no-follow-tags "$HTTPS_URL" "$1"
}

# Best-effort desktop notification (no-op if unavailable, e.g. headless cron).
notify() {
  command -v osascript >/dev/null 2>&1 || return 0
  osascript -e "display notification \"$1\" with title \"Twenty upstream sync\"" \
    >/dev/null 2>&1 || true
}

# Count rows from a gh query. Echoes an integer on success; on ANY failure
# (network, auth, disabled feature, unexpected output) echoes nothing and
# returns 1 — callers must treat that as "unknown", never as zero.
gh_count() {
  local out
  out="$(gh "$@" 2>/dev/null)" || return 1
  [[ "$out" =~ ^[0-9]+$ ]] || return 1
  echo "$out"
}

# Report a conflict through whatever channel still works. Tries a GitHub issue
# first, but issues can be disabled on the repo (they were on 2026-07-27, which
# is how a conflict went unnoticed for a week), so it always falls back to an
# on-disk alert file plus a desktop notification. Never silent.
report_conflict() {
  local behind="$1" conflicts="$2" body

  body="$(printf 'Weekly upstream sync could not merge twentyhq/twenty main (%s commits behind) — manual merge needed:\n\n```\ngit fetch upstream && git switch -c sync/upstream-manual main && git merge upstream/main\n```\n\nReal code conflicts (locale catalogs and generated GraphQL types are excluded — resolve those by taking upstream and regenerating afterwards):\n```\n%s\n```\n\nSee the "weekly upstream sync playbook" (PR #93 and #135 bodies) for how past conflicts in these files were resolved.\n' \
    "$behind" "$conflicts")"

  # Only suppress a duplicate when we can CONFIRM one is already open. If the
  # query itself fails, report anyway — a duplicate beats silence.
  local open_issues
  open_issues="$(gh_count issue list -R "$REPO" --state open \
    --search 'Upstream sync conflict in:title' --json number --jq length)"
  if [ "${open_issues:-0}" -gt 0 ]; then
    log "CONFLICT: issue already open — skipping duplicate"
    return 0
  fi

  if gh issue create -R "$REPO" \
       --title "Upstream sync conflict ($(date +%Y-%m-%d))" \
       --body "$body" >/dev/null 2>&1; then
    log "CONFLICT: issue opened"
    return 0
  fi

  # Issue creation failed — say so explicitly, then use the fallbacks.
  log "CONFLICT: could NOT open a GitHub issue (issues disabled on $REPO, or gh failed)"
  if printf '%s\n' "$body" > "$ALERT_FILE" 2>/dev/null; then
    log "CONFLICT: wrote $ALERT_FILE"
  else
    log "CONFLICT: could not write $ALERT_FILE either — this log is the only record"
  fi
  notify "Upstream merge conflicted; see $ALERT_FILE"
}

log "$(date) fetching..."
git fetch --quiet origin main
git fetch --quiet upstream main

# Surface a dead reporting channel on every run, not only on the week it bites.
if [ "$(gh api "repos/$REPO" --jq .has_issues 2>/dev/null)" != "true" ]; then
  log "WARNING: issues are disabled on $REPO — conflicts will fall back to $ALERT_FILE"
fi

if git merge-base --is-ancestor upstream/main origin/main; then
  log "fork already contains upstream/main — nothing to do"
  exit 0
fi

# One sync PR at a time; don't stack a new one on an unreviewed one.
OPEN_SYNC_PRS="$(gh_count pr list -R "$REPO" --state open --json headRefName \
  --jq '[.[] | select(.headRefName | startswith("sync/upstream"))] | length')"
if [ -z "$OPEN_SYNC_PRS" ]; then
  log "FAIL: could not list open PRs on $REPO — aborting rather than risk a duplicate"
  notify "Could not reach GitHub to check for an open sync PR"
  exit 1
fi
if [ "$OPEN_SYNC_PRS" -gt 0 ]; then
  log "an open sync PR already exists — merge or close it first"
  exit 0
fi

BEHIND=$(git rev-list --count origin/main..upstream/main)
BRANCH="sync/upstream-$(date +%Y-%m-%d)"
WORKTREE="$(mktemp -d)/sync"
git worktree add --quiet --detach "$WORKTREE" origin/main
cleanup() {
  git worktree remove --force "$WORKTREE" 2>/dev/null
  git branch -D "$BRANCH" 2>/dev/null
}
trap cleanup EXIT

cd "$WORKTREE"
git switch --quiet -c "$BRANCH"

if git merge --no-edit upstream/main >/dev/null 2>&1; then
  # Flag schema-touching changes so the reviewer knows a DB migration rides along.
  SCHEMA_CHANGES=$(git diff --name-only origin/main..upstream/main -- \
    'packages/twenty-server/src/database' '**/*.entity.ts' | head -20)
  if ! push_branch "$BRANCH"; then
    log "FAIL: merged cleanly but could not push $BRANCH (does the gh token have the 'workflow' scope?)"
    notify "Upstream sync merged but the push failed"
    exit 1
  fi
  if ! gh pr create -R "$REPO" --base main --head "$BRANCH" \
    --title "Sync upstream twentyhq/twenty ($BEHIND commits)" \
    --body "$(printf 'Automated weekly upstream sync (%s upstream commits, merged cleanly).\n\nAfter merging, deploy with the usual pull in ~/Deploy/twenty; the post-merge hook runs update-after-merge.sh (yarn install + DB migrate + cache invalidate) when needed.\n\n%s' \
      "$BEHIND" \
      "$( if [ -n "$SCHEMA_CHANGES" ]; then printf '**Schema/migration files changed upstream** — review with extra care:\n```\n%s\n```' "$SCHEMA_CHANGES"; else echo 'No schema/migration changes detected upstream.'; fi )")"; then
    log "FAIL: pushed $BRANCH but could not open the PR — open it by hand"
    notify "Upstream sync branch pushed but the PR was not created"
    exit 1
  fi
  log "OK: PR opened for $BRANCH ($BEHIND commits)"
else
  # Locale catalogs and the generated metadata GraphQL types conflict on
  # nearly every sync and are always resolved the same way: take upstream,
  # regenerate after the merge. Resolve those mechanically so a human only
  # sees real code conflicts.
  MECHANICAL_PATHS=(
    'packages/twenty-front/src/locales'
    'packages/twenty-server/src/engine/core-modules/i18n/locales'
    'packages/twenty-front/src/generated-metadata/graphql.ts'
  )

  # Hundreds of back-to-back index writes can trip over a not-yet-released
  # index.lock on macOS; retry instead of misclassifying the failure. A file
  # that still fails stays conflicted and flows into REMAINING below.
  run_with_retry() {
    local attempt
    for attempt in 1 2 3; do
      "$@" 2>/dev/null && return 0
      sleep 1
    done
    return 1
  }

  while IFS= read -r conflicted_file; do
    if [ -n "$(git ls-files -u -- "$conflicted_file" | awk '$3 == 3')" ]; then
      run_with_retry git checkout --theirs -- "$conflicted_file" &&
        run_with_retry git add -- "$conflicted_file"
    else
      # No stage 3: upstream deleted the file; taking upstream means git rm.
      run_with_retry git rm -q -- "$conflicted_file"
    fi
  done < <(git diff --name-only --diff-filter=U -- "${MECHANICAL_PATHS[@]}")

  REMAINING=$(git diff --name-only --diff-filter=U)

  if [ -n "$REMAINING" ]; then
    git merge --abort 2>/dev/null
    report_conflict "$BEHIND" "$REMAINING"
    exit 1
  fi

  # Only generated files conflicted — commit the merge and open the PR with a
  # loud regeneration checklist. CI fails on the stale catalogs until the
  # regeneration commit lands, which is intended: it blocks merging the PR
  # with the fork's strings and types missing.
  if ! git -c user.name="sync-upstream" -c user.email="sync-upstream@localhost" \
       commit --no-edit >/dev/null 2>&1; then
    log "FAIL: could not commit the mechanically resolved merge"
    notify "Upstream sync auto-resolution failed to commit"
    exit 1
  fi
  if ! push_branch "$BRANCH"; then
    log "FAIL: resolved mechanically but could not push $BRANCH"
    notify "Upstream sync merged but the push failed"
    exit 1
  fi
  if ! gh pr create -R "$REPO" --base main --head "$BRANCH" \
    --title "Sync upstream twentyhq/twenty ($BEHIND commits, regeneration needed)" \
    --body "$(printf 'Automated weekly upstream sync (%s upstream commits). Only locale catalogs and generated GraphQL types conflicted; they were resolved by taking upstream, so the fork'"'"'s strings and types are MISSING until regenerated.\n\n**Do not merge yet — check out this branch and push a regeneration commit first:**\n\n```\nnpx nx run twenty-front:lingui:extract && npx nx run twenty-front:lingui:compile\nnpx nx run twenty-server:lingui:extract && npx nx run twenty-server:lingui:compile\n# with a dev server running against the merged code:\nnpx nx run twenty-front:graphql:generate --configuration=metadata\n```\n\nCI is expected to fail until that commit lands. Then verify per deploy/TEAM-WORKFLOW.md as usual.' \
      "$BEHIND")"; then
    log "FAIL: pushed $BRANCH but could not open the PR — open it by hand"
    notify "Upstream sync branch pushed but the PR was not created"
    exit 1
  fi
  log "OK: PR opened for $BRANCH ($BEHIND commits, generated files need regeneration)"
fi
