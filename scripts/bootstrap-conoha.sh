#!/usr/bin/env bash
set -euo pipefail

# NORIZO ConoHa convergence bootstrap
#
# Purpose:
# - converge the existing VPS toward the 24/7 AI WORK FACTORY baseline
# - preserve the running host; never rebuild/recreate it
# - keep browser infrastructure deferred until a real workload requires it
# - install the local-only health monitor first
#
# This script never stores API keys, tokens or passwords in the repository.

if [ "$(id -u)" -ne 0 ]; then
  echo "This bootstrap must run as root." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
ROOT_DIR=/opt/norizo
DEVROOM_DIR="$ROOT_DIR/norizo-dev-room"
STEEL_DIR="$ROOT_DIR/steel"
INSTALL_HEALTH="${INSTALL_HEALTH:-1}"
INSTALL_STEEL="${INSTALL_STEEL:-0}"

echo "== NORIZO AI WORK FACTORY convergence bootstrap =="

apt-get update -y
apt-get install -y \
  ca-certificates \
  curl \
  git \
  jq \
  unzip \
  openssh-client \
  gh \
  python3 \
  tmux \
  ripgrep \
  build-essential

# Docker is required by some later workloads, but no public container ports are
# opened here.
if ! command -v docker >/dev/null 2>&1; then
  apt-get install -y docker.io
fi

if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-v2 || apt-get install -y docker-compose-plugin || true
fi

systemctl enable --now docker
mkdir -p "$ROOT_DIR" "$ROOT_DIR/system"

# DEV ROOM is public. Preserve local changes; never hard-reset the working copy.
if [ -d "$DEVROOM_DIR/.git" ]; then
  git -C "$DEVROOM_DIR" fetch origin main
  git -C "$DEVROOM_DIR" merge --ff-only origin/main
else
  git clone --depth 1 https://github.com/NORIZO0201/norizo-dev-room.git "$DEVROOM_DIR"
fi

# Health monitoring comes before resident workers so failures are observable
# from the first deployed worker onward.
if [ "$INSTALL_HEALTH" = "1" ]; then
  bash "$DEVROOM_DIR/deploy/health/install-health-monitor.sh"
else
  echo "Health monitor installation deferred (INSTALL_HEALTH=$INSTALL_HEALTH)."
fi

# Steel is deliberately opt-in. Routine work should prefer API/RSS/sitemap/
# structured-data paths and only introduce a browser when a concrete task
# requires one.
if [ "$INSTALL_STEEL" = "1" ]; then
  mkdir -p "$STEEL_DIR/cache"
  cat > "$STEEL_DIR/compose.yaml" <<'YAML'
services:
  steel:
    image: ghcr.io/steel-dev/steel-browser:latest
    container_name: norizo-steel
    restart: unless-stopped
    shm_size: "2gb"
    ports:
      - "127.0.0.1:3000:3000"
      - "127.0.0.1:9223:9223"
    volumes:
      - ./cache:/app/.cache
YAML

  cd "$STEEL_DIR"
  docker compose -f compose.yaml pull
  docker compose -f compose.yaml up -d
  sleep 4
  curl -fsS http://127.0.0.1:3000/api/health >/dev/null
  echo "Steel Self-host: healthy on loopback only."
else
  echo "Steel Self-host: deferred until a browser-dependent workload requires it."
fi

echo
echo "== Tool verification =="
printf "git:      "; git --version || true
printf "gh:       "; gh --version 2>/dev/null | head -1 || echo "not available"
printf "python3:  "; python3 --version || true
printf "docker:   "; docker --version || true
printf "compose:  "; docker compose version || true
printf "tmux:     "; tmux -V || true
printf "rg:       "; rg --version 2>/dev/null | head -1 || echo "not available"

if command -v claude >/dev/null 2>&1; then
  printf "claude:   "
  claude --version || true
else
  echo "claude:   not found; leave authentication/install remediation to the implementation agent"
fi

if command -v codex >/dev/null 2>&1; then
  printf "codex:    "
  codex --version || true
else
  echo "codex:    not found; leave authentication/install remediation to the implementation agent"
fi

echo
echo "== Local services =="
systemctl is-active norizo-health.service 2>/dev/null || true
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo
echo "DEV ROOM: $DEVROOM_DIR"
echo "No production deployment was performed."
echo "No new public port was opened."
