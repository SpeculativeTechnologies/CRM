#!/usr/bin/env bash
# Read-only follow-through for one exact source commit. Never dispatch a deploy.
set -euo pipefail
sha="${1:-$(git rev-parse HEAD)}"
repo="${CI_REPOSITORY:-SpeculativeTechnologies/CRM}"
minutes="${CI_FOLLOW_TIMEOUT_MINUTES:-40}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Full SHA required' >&2; exit 2; }
[[ "$minutes" =~ ^[1-9][0-9]*$ ]] || exit 2
umask 077
directory="$(git rev-parse --show-toplevel)/deploy/.migration-tests/ci-$sha"
mkdir -p "$directory"
deadline=$(( $(date +%s) + minutes * 60 ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  gh run list --repo "$repo" --commit "$sha" --limit 100 \
    --json databaseId,workflowName,status,conclusion,headSha,url > "$directory/runs.json"
  # Require the intended workflow to exist; an empty result is not a pass.
  if jq -e 'any(.[]; .workflowName == "CI Fork") and all(.[]; .status == "completed")' "$directory/runs.json" >/dev/null; then
    failed="$(jq -r '.[] | select(.conclusion != "success" and .conclusion != "skipped" and .conclusion != "neutral") | .databaseId' "$directory/runs.json")"
    if [ -n "$failed" ]; then
      while read -r run; do
        gh run view "$run" --repo "$repo" --log-failed > "$directory/$run.log" 2>&1 || true
      done <<<"$failed"
      echo "CI failed for $sha. Private diagnostics: $directory" >&2
      jq -r '.[] | select(.conclusion == "failure") | "\(.workflowName): \(.url)"' "$directory/runs.json"
      exit 1
    fi
    echo "CI passed for $sha. Records: $directory/runs.json"
    exit 0
  fi
  echo "Waiting for checks on ${sha:0:12}; deadline ${minutes} minutes."
  sleep 15
done
echo "Timed out waiting for exact-commit CI. Records: $directory" >&2
exit 1
