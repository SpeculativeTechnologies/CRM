#!/bin/bash
# =============================================================================
# Bootstrap a cloud VM to run Twenty behind a Cloudflare tunnel.
# =============================================================================
# Target: Ubuntu LTS arm64 on GCP c4a-standard-2, no external IP address.
# Run as root on a fresh instance:
#
#   sudo CLOUD_DATA_DEVICE=/dev/disk/by-id/google-twenty-data \
#        bash deploy/cloud-bootstrap.sh
#
# Idempotent: safe to re-run on a box that is already set up.
#
# What it does NOT do, on purpose:
# - It never writes deploy/.env.cloud. Secrets are placed by hand, root-owned
#   0600, outside any git clone.
# - It never starts the stack. Bring-up is deliberate, after the env file exists
#   and a dump has been restored.
# - It never touches sshd's ListenAddress. Binding sshd to the tailnet IP looks
#   appealing but fails closed if tailscaled has not assigned an address yet,
#   which locks you out of a box that has no external IP and therefore no
#   console-free recovery path. The perimeter is the absent external IP plus a
#   default-deny VPC firewall; sshd hardening here is defence in depth, not the
#   perimeter.
#
# See deploy/ACCESS.md, Phase C, for where this sits in the sequence.
# =============================================================================
set -euo pipefail

SERVICE_USER="${CLOUD_SERVICE_USER:-twenty}"
DATA_ROOT="${CLOUD_DATA_ROOT:-/srv/twenty}"
DATA_DEVICE="${CLOUD_DATA_DEVICE:-}"
FORMAT_DATA_DISK="${FORMAT_DATA_DISK:-false}"

log() { echo "[bootstrap] $*"; }
fail() {
  echo "[bootstrap] FAIL: $*" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || fail "run as root"
[ "$(uname -m)" = "aarch64" ] ||
  log "WARNING: not aarch64; the GHCR image publishes arm64 only"

# --- data disk ---------------------------------------------------------------
# The database and attachments must live on a disk with auto-delete off, so that
# deleting or rebuilding the instance cannot take the data with it.
mount_data_disk() {
  [ -n "$DATA_DEVICE" ] ||
    fail "set CLOUD_DATA_DEVICE to the data disk (e.g. /dev/disk/by-id/google-twenty-data)"
  [ -b "$DATA_DEVICE" ] || fail "$DATA_DEVICE is not a block device"

  local existing_fs
  existing_fs="$(blkid -o value -s TYPE "$DATA_DEVICE" 2>/dev/null || true)"

  if [ -z "$existing_fs" ]; then
    # Refuse to format implicitly. An unformatted disk is indistinguishable from
    # a disk whose superblock we failed to read, and one of those cases holds the
    # only copy of the CRM.
    [ "$FORMAT_DATA_DISK" = "true" ] ||
      fail "$DATA_DEVICE has no filesystem. If it is genuinely new, re-run with FORMAT_DATA_DISK=true"
    log "formatting $DATA_DEVICE as ext4"
    mkfs.ext4 -m 0 -E lazy_itable_init=0,lazy_journal_init=0,discard "$DATA_DEVICE"
  else
    log "$DATA_DEVICE already holds $existing_fs; leaving it alone"
  fi

  mkdir -p "$DATA_ROOT"

  local uuid
  uuid="$(blkid -o value -s UUID "$DATA_DEVICE")" ||
    fail "cannot read UUID of $DATA_DEVICE"

  # By UUID, not device name: GCP device ordering is not guaranteed stable.
  # No `nofail`, deliberately. If this disk is missing, the box must not boot
  # into a state where Postgres silently creates a fresh database on the boot
  # disk and starts accepting writes into it.
  if ! grep -q "UUID=$uuid" /etc/fstab; then
    log "adding $DATA_ROOT to /etc/fstab"
    printf 'UUID=%s %s ext4 defaults,x-systemd.device-timeout=30s 0 2\n' \
      "$uuid" "$DATA_ROOT" >>/etc/fstab
  fi

  mountpoint -q "$DATA_ROOT" || mount "$DATA_ROOT"
  mountpoint -q "$DATA_ROOT" || fail "$DATA_ROOT did not mount"

  mkdir -p "$DATA_ROOT/postgres" "$DATA_ROOT/redis" "$DATA_ROOT/attachments"
  # Postgres in the official image runs as uid 999; the server image writes
  # attachments as its own user, so that directory is handed to the service user.
  chown 999:999 "$DATA_ROOT/postgres" "$DATA_ROOT/redis"
  chmod 700 "$DATA_ROOT/postgres"
  log "data disk mounted at $DATA_ROOT"
}

# --- packages ----------------------------------------------------------------
install_base_packages() {
  log "installing base packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq \
    ca-certificates curl gnupg jq postgresql-client-16 unattended-upgrades
}

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "docker already installed"
    return
  fi
  log "installing docker from Docker's apt repository"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu %s stable\n' \
    "$(dpkg --print-architecture)" "$(. /etc/os-release && echo "$VERSION_CODENAME")" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

install_tailscale() {
  if command -v tailscale >/dev/null 2>&1; then
    log "tailscale already installed"
    return
  fi
  log "installing tailscale"
  curl -fsSL https://tailscale.com/install.sh | sh
  # Left un-authenticated on purpose: `tailscale up` needs an interactive auth
  # key. Run it by hand, or pass an ephemeral authkey, once the box is up.
  log "run 'tailscale up --ssh' by hand to join the tailnet"
}

# --- hardening ---------------------------------------------------------------
create_service_user() {
  if id "$SERVICE_USER" >/dev/null 2>&1; then
    log "service user $SERVICE_USER exists"
  else
    log "creating service user $SERVICE_USER"
    useradd --system --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
  fi
  usermod -aG docker "$SERVICE_USER"
  chown -R "$SERVICE_USER":"$SERVICE_USER" "$DATA_ROOT/attachments"
}

harden_ssh() {
  log "hardening sshd"
  cat >/etc/ssh/sshd_config.d/99-twenty.conf <<'EOF'
# Managed by deploy/cloud-bootstrap.sh
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
X11Forwarding no
EOF
  sshd -t || fail "sshd config is invalid; not reloading"
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
}

enable_unattended_upgrades() {
  log "enabling unattended security upgrades"
  cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
  systemctl enable --now unattended-upgrades
}

# --- verification ------------------------------------------------------------
verify() {
  log "--- verification ---"
  mountpoint -q "$DATA_ROOT" &&
    log "OK   data disk mounted: $(findmnt -no SOURCE "$DATA_ROOT")" ||
    fail "data disk not mounted"
  docker --version | sed 's/^/[bootstrap] OK   /'
  docker compose version --short | sed 's/^/[bootstrap] OK   compose /'
  id "$SERVICE_USER" >/dev/null && log "OK   service user $SERVICE_USER"
  command -v tailscale >/dev/null && log "OK   tailscale installed"
  # A box with an external IP is a box this design did not intend to exist.
  #
  # The body is the signal, not curl's exit status. This metadata path answers
  # 200 with an EMPTY body when the instance has no external IP, so `curl -sf`
  # succeeds either way and warns on every correctly built box. A check that
  # cries wolf is worse than no check, because it is the one that gets ignored
  # on the day it is right.
  local external_ip
  external_ip="$(curl -s -H 'Metadata-Flavor: Google' \
    'http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip' \
    2>/dev/null || true)"
  if [ -n "$external_ip" ]; then
    log "WARNING: this instance HAS an external IP ($external_ip). Phase C specifies none."
  else
    log "OK   no external IP"
  fi
  log "--- next: place deploy/.env.cloud (root, 0600), restore a dump, then bring up ---"
}

mount_data_disk
install_base_packages
install_docker
install_tailscale
create_service_user
harden_ssh
enable_unattended_upgrades
verify
