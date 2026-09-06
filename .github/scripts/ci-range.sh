#!/usr/bin/env bash
# Validate the checkout actually tested, including GitHub's synthetic PR merge.
set -euo pipefail
head="$(git rev-parse HEAD)"
if [ "${GITHUB_EVENT_NAME:-}" = pull_request ]; then
  base="$(jq -er .pull_request.base.sha "$GITHUB_EVENT_PATH")"
elif [ "${GITHUB_EVENT_NAME:-}" = push ]; then
  base="$(jq -er .before "$GITHUB_EVENT_PATH")"
else
  base="$(git merge-base origin/main HEAD)"
fi
if ! [[ "$base" =~ ^[0-9a-f]{40}$ ]] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  echo 'Cannot resolve the tested Git range; refusing empty validation.' >&2
  exit 1
fi
if [ "$base" = "$head" ] && [ "${GITHUB_EVENT_NAME:-}" = push ]; then
  echo 'Push base equals head; refusing empty validation.' >&2
  exit 1
fi
printf 'NX_BASE=%s\nNX_HEAD=%s\n' "$base" "$head" >> "${GITHUB_ENV:-/dev/stdout}"
