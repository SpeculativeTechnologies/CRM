#!/bin/bash
# =============================================================================
# How much of upstream does this fork modify in place?
# =============================================================================
# Prints the upstream-tracked source files that fork commits have changed and
# the directories that carry them. Each of these is a potential conflict on the
# next weekly sync; the total is the leading indicator of how painful that sync
# will be. See deploy/UPSTREAM-SYNC.md, "Keeping the fork mergeable".
#
#   bash deploy/upstream-footprint.sh          # summary by directory
#   bash deploy/upstream-footprint.sh --files  # every file
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

git remote get-url upstream >/dev/null 2>&1 ||
  git remote add upstream https://github.com/twentyhq/twenty.git
git fetch --quiet upstream main
git fetch --quiet origin main

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Derived files are regenerated on every sync and never count.
DERIVED='locales/|/generated|__snapshots__|\.snap$|^yarn\.lock$'

git ls-tree -r --name-only upstream/main | LC_ALL=C sort -u > "$WORK/upstream"
git log --format= --name-only --no-merges upstream/main..origin/main |
  grep -v -E "$DERIVED" | LC_ALL=C sort -u > "$WORK/fork"
LC_ALL=C comm -12 "$WORK/upstream" "$WORK/fork" > "$WORK/footprint"

TOTAL="$(wc -l < "$WORK/footprint" | tr -d ' ')"
ADDED="$(LC_ALL=C comm -13 "$WORK/upstream" "$WORK/fork" | wc -l | tr -d ' ')"

echo "Upstream-tracked files modified by fork commits: $TOTAL"
echo "Fork-only files (no conflict risk):              $ADDED"
echo

if [ "${1:-}" = "--files" ]; then
  cat "$WORK/footprint"
  exit 0
fi

echo "By directory (top 25):"
awk -F/ '{ d = $1; for (i = 2; i <= 5 && i <= NF - 1; i++) d = d "/" $i; print d }' \
  "$WORK/footprint" | sort | uniq -c | sort -rn | head -25
