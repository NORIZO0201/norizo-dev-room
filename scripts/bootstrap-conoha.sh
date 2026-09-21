#!/usr/bin/env bash
set -euo pipefail

# NORIZO ConoHa bootstrap
# Goal:
# - prepare the VPS as the 24/7 AI WORK FACTORY
# - install Docker tooling
# - deploy Steel Self-host privately on localhost
# - clone/update DEV ROOM
# - prepare GitHub + Claude Code verification
#
# This script never stores API keys, tokens or passwords in the repository.

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
ROOT_DIR=/opt/norizo
DEVROOM_DIR="$ROOT_DIR/norizo-dev-room"
STEEL_DIR="$ROOT_DIR/steel"

echo "== NORIZO AI WORK FACTORY bootstrap =="

apt-get update -y
apt-get install -y ca-certificates curl git jq unzip openssh-client gh

# Docker
if ! command -v docker >/dev/null 2>&1; then
  apt-get install -y docker.io
fi

# Docker Compose v2 package name differs by image/repository.
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-v2 || apt-get install -y docker-compose-plugin || true
fi

systemctl enable --now docker

mkdir -p "$ROOT_DIR" "$STEEL_DIR/cache"

# DEV ROOM is public, so initial clone requires no secret.
if [ -d "$DEVROOM_DIR/.git" ]; then
  git -C "$DEVROOM_DIR" fetch origin main
  git -C "$DEVROOM_DIR" reset --hard origin/main
else
  git clone --depth 1 https://github.com/NORIZO0201/norizo-dev-room.git "$DEVROOM_DIR"
fi

# Steel Self-host.
# Intentionally bind only to localhost. Never expose CDP 9223 directly to the Internet.
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
echo
echo "== Steel health =="
curl -fsS http://127.0.0.1:3000/api/health || true
echo

# Claude Code should already be installed when the ConoHa Claude Code startup template was used.
echo
echo "== Claude Code =="
if command -v claude >/dev/null 2>&1; then
  claude --version || true
else
  echo "Claude Code was not found."
  if command -v npm >/dev/null 2>&1; then
    npm install -g @anthropic-ai/claude-code || true
    command -v claude >/dev/null 2>&1 && claude --version || true
  else
    echo "npm is also missing; verify the ConoHa Claude Code startup template."
  fi
fi

echo
echo "== GitHub =="
if command -v gh >/dev/null 2>&1; then
  gh --version | head -1
else
  echo "GitHub CLI installation failed; git itself is available."
fi

echo
echo "== Services =="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo
echo "DEV ROOM: $DEVROOM_DIR"
echo "Steel:    http://127.0.0.1:3000"
echo
echo "NEXT ONE-TIME AUTH:"
echo "  1) Claude Code: claude"
echo "  2) GitHub private repos: install/login with gh, or add a read-only deploy key"
echo
echo "After that, resident workers can run without the Mac or ChatGPT session."
