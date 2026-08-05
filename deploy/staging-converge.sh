#!/bin/bash
set -euo pipefail

# Converges staging onto whatever refs/heads/staging-target points at.
#
# Runs from launchd on the staging host. Every call it makes is outbound: it
# fetches the ref, checks GHCR for the matching image, moves this checkout onto
# the target commit and restarts staging. Nothing reaches in from GitHub, so
# this adds no inbound access to the machine that also runs production.
#
# The ref is moved by the "Deploy to staging" workflow, which has already
# checked that the commit exists and that CI published an image for it. The
# checks here are the second half of that: this script refuses anything it
# cannot independently confirm, because it is the side holding the credentials.
#
# Both halves of a deploy have to move together. staging.sh composes from this
# checkout, so an image swap alone leaves the new server running against the
# previous compose file and deploy scripts, and nothing reports the mismatch.
# Production has always done this (production-converge.sh fast-forwards its
# checkout); staging now matches.
#
# The whole body lives in main() so bash parses this file completely before
# executing any of it. The checkout below can replace this script mid-run, and
# bash otherwise resumes reading a file whose contents have shifted underneath
# its saved offset.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGING_ENV="$REPO_ROOT/deploy/.env.staging"
STATE_FILE="/tmp/twenty-staging-converge-state"
# The last SHA a deployment status was reported for, so an already-converged
# host reports once rather than every tick.
REPORTED_FILE="/tmp/twenty-staging-converge-reported"
LOG_PREFIX="[staging-converge]"

# Shared with refresh-staging-from-production.sh. Both drive staging.sh, and a
# deploy landing midway through a data refresh would leave staging inconsistent.
LOCK="/tmp/twenty-staging-refresh.lock"

TARGET_BRANCH="staging-target"
TOKEN_FILE="${TWENTY_STAGING_TOKEN_FILE:-$HOME/.config/twenty-staging/github-token}"

log() {
  echo "$LOG_PREFIX $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

fail() {
  echo "$LOG_PREFIX ERROR: $*" >&2
  exit 1
}

# Every deploy pulls a multi-gigabyte image tagged with its commit SHA and
# nothing ever removed the old ones, so the Colima disk filled and the pull
# started failing with "no space left on device". Rollback needs the image it
# is rolling back to, and the pull needs the one it is fetching; every other
# tag of this repository is spent. Images held by a running container refuse to
# be removed, which is the backstop that keeps this from taking staging down.
prune_spent_staging_images() {
  local image_repo="$1" keep_current="$2" keep_target="$3" image
  local -a spent=()

  while read -r image; do
    [ -n "$image" ] || continue
    case "$image" in
      "$keep_current" | "$keep_target") continue ;;
      # A dangling entry has no tag to remove it by, and this flow never
      # produces one: each deploy tags a distinct SHA, so nothing is overwritten.
      *:'<none>') continue ;;
    esac
    spent+=("$image")
  done < <(docker images --format '{{.Repository}}:{{.Tag}}' "$image_repo" 2>/dev/null || true)

  [ "${#spent[@]}" -gt 0 ] || return 0

  log "removing ${#spent[@]} spent staging image(s) to reclaim disk"
  for image in "${spent[@]}"; do
    docker image rm "$image" >/dev/null 2>&1 ||
      log "could not remove ${image}; it may still be in use"
  done
}

write_image() {
  local image="$1" tmp
  tmp="$(mktemp)"
  awk -v img="$image" \
    '/^STAGING_IMAGE=/ { print "STAGING_IMAGE=" img; next } { print }' \
    "$STAGING_ENV" >"$tmp"
  # mktemp gives 0600, which is what a file holding staging secrets should be.
  mv "$tmp" "$STAGING_ENV"
}

# Use the dedicated token if present, else the host's ambient `gh auth`. The
# token was previously required, and it has never existed here, so staging has
# never reported a deployment status either — see production-converge.sh for the
# same fix and the reasoning.
gh_deploy() {
  if [ -f "$TOKEN_FILE" ]; then
    GH_TOKEN="$(cat "$TOKEN_FILE")" gh "$@"
  else
    gh "$@"
  fi
}

report() {
  local state="$1" description="$2" deployment_id
  deployment_id="$(
    gh_deploy api \
      "repos/${GITHUB_REPOSITORY:-SpeculativeTechnologies/CRM}/deployments?environment=staging&sha=${target_sha}" \
      --jq '.[0].id' 2>/dev/null || true
  )"
  if [ -z "$deployment_id" ] || [ "$deployment_id" = "null" ]; then
    log "cannot report '${state}': no staging deployment found for ${target_sha} (is gh authenticated on this host?)"
    return 0
  fi
  gh_deploy api --method POST \
    "repos/${GITHUB_REPOSITORY:-SpeculativeTechnologies/CRM}/deployments/${deployment_id}/statuses" \
    -f state="$state" -f description="$description" >/dev/null 2>&1 ||
    log "failed to POST '${state}' status to deployment ${deployment_id}"
}

main() {
  [ -f "$STAGING_ENV" ] || fail "Missing $STAGING_ENV"

  # A held lock means a refresh or an earlier convergence is still running. Skip
  # quietly and pick it up next tick rather than queueing behind it.
  if ! mkdir "$LOCK" 2>/dev/null; then
    log "another staging operation holds the lock; skipping this tick"
    exit 0
  fi
  trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

  cd "$REPO_ROOT"

  git fetch --quiet origin \
    "+refs/heads/${TARGET_BRANCH}:refs/remotes/origin/${TARGET_BRANCH}" 2>/dev/null ||
    {
      log "no ${TARGET_BRANCH} ref published yet; nothing to converge"
      exit 0
    }

  target_sha="$(git rev-parse "refs/remotes/origin/${TARGET_BRANCH}")"

  # Refuse a ref that does not resolve to a commit we actually have.
  git cat-file -e "${target_sha}^{commit}" 2>/dev/null ||
    fail "${TARGET_BRANCH} does not resolve to a known commit"

  current_image="$(
    grep -E '^STAGING_IMAGE=' "$STAGING_ENV" | head -1 | cut -d= -f2-
  )"
  [ -n "$current_image" ] || fail "STAGING_IMAGE is not set in $STAGING_ENV"
  current_sha="${current_image##*:}"
  current_head="$(git rev-parse HEAD)"

  # The registry is explicit rather than derived from the current value. A host
  # that has never pulled from GHCR starts out on a locally built image name, and
  # deriving the repo from that sends every lookup to the wrong registry while
  # reporting it as a missing image.
  image_repo="${STAGING_IMAGE_REPO:-ghcr.io/speculativetechnologies/twenty}"

  # Converged means both halves are on the target, not just the image. A host
  # left with the right image and a stale tree has to be able to catch up.
  if [ "$current_sha" = "$target_sha" ] && [ "$current_head" = "$target_sha" ]; then
    # Redeploying a SHA that is already running produces a deployment nothing
    # ever closes: the convergence that would have reported success is exactly
    # the one skipped here, so it sits in_progress forever. Report once per
    # SHA, tracked in a file so a converged host makes no API calls per tick.
    if [ "$(cat "$REPORTED_FILE" 2>/dev/null)" != "$target_sha" ]; then
      report success "staging is already running ${target_sha}"
      echo "$target_sha" >"$REPORTED_FILE"
    fi
    exit 0
  fi

  target_image="${image_repo}:${target_sha}"
  log "converging image ${current_sha} and checkout ${current_head} -> ${target_sha}"

  # The workflow checked this too, but this side is the one that can actually
  # pull, so a missing image has to stop here rather than half-apply.
  target_manifest="$(docker manifest inspect "$target_image" 2>/dev/null)" ||
    fail "Cannot resolve ${target_image}. Check that CI published that commit and \
that this host is logged in to GHCR."

  # A manifest list can exist without covering this host. Catching that here beats
  # discovering it halfway through a restart and rolling back for no reason.
  case "$(uname -m)" in
    arm64 | aarch64) required_architecture="arm64" ;;
    x86_64 | amd64) required_architecture="amd64" ;;
    *) fail "Unsupported host architecture $(uname -m)" ;;
  esac

  printf '%s\n' "$target_manifest" |
    grep -q "\"architecture\": \"${required_architecture}\"" ||
    fail "${target_image} publishes no ${required_architecture} image; this host \
cannot run it."

  # Refuse to discard someone's in-progress edit. Untracked files are left
  # alone, which is what keeps the gitignored .env.staging safe across this.
  git diff --quiet HEAD ||
    fail "the staging checkout has uncommitted changes; commit or discard them \
before deploying ${target_sha}"

  # Detached on purpose: staging deploys unmerged commits, so there is no branch
  # to fast-forward. `git switch -` returns the host to a branch by hand.
  git checkout --quiet --detach "$target_sha" ||
    fail "cannot check out ${target_sha} in the staging checkout"

  # Before the pull, not after: a full disk fails the pull itself, so a cleanup
  # that only ran on success could never rescue a host already wedged.
  prune_spent_staging_images "$image_repo" "$current_image" "$target_image"

  write_image "$target_image"

  # Order matters. A server image newer than the database cannot pass its
  # healthcheck, so containers start without the health gate, the schema is
  # brought forward, and only then is health required.
  #
  # Stepped rather than chained with && so the reported failure can name the
  # gate that refused. Without the name, a rollback loop is indistinguishable
  # from a bad commit, a stale schema and an unpullable image, and the only
  # thing that tells them apart lives in this host's log.
  failed_step=""
  for step in "up --no-wait" migrate wait up test; do
    # Unquoted on purpose: "up --no-wait" has to split into two arguments.
    # shellcheck disable=SC2086
    if ! bash "$REPO_ROOT/deploy/staging.sh" $step; then
      failed_step="$step"
      break
    fi
  done

  if [ -z "$failed_step" ]; then
    echo "$target_sha" >"$STATE_FILE"
    log "staging is now running ${target_sha}"
    report success "staging is running ${target_sha}"
    # Recorded here too, so the next tick's already-converged path knows this
    # SHA has been reported and does not post a duplicate success.
    echo "$target_sha" >"$REPORTED_FILE"
    exit 0
  fi

  # Roll back to the image and the tree that were serving before, so a bad
  # commit does not leave staging down until someone can get to the host.
  log "convergence to ${target_sha} failed at '${failed_step}'; restoring ${current_sha}"
  write_image "$current_image"
  git checkout --quiet --detach "$current_head" ||
    log "WARNING: could not restore the checkout to ${current_head}"
  if bash "$REPO_ROOT/deploy/staging.sh" up; then
    log "restored ${current_sha}"
    report failure \
      "deploy of ${target_sha} failed at '${failed_step}'; rolled back to ${current_sha}"
  else
    log "ROLLBACK FAILED: staging is down and needs manual attention"
    report error \
      "deploy of ${target_sha} failed at '${failed_step}' and rollback failed"
  fi
  exit 1
}

main "$@"
