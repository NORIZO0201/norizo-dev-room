#!/usr/bin/env bash
set -euo pipefail

# NORIZO LAB ConoHa deterministic batch-host setup.
# This script does not install or invoke Claude Code, Codex, Gemini,
# GitHub task polling, autonomous control planes, or AI dispatchers.

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
ROOT=/opt/norizo
STEEL_DIR="$ROOT/steel"

apt-get update -y
apt-get install -y ca-certificates curl git jq python3 tmux ripgrep build-essential

if ! command -v docker >/dev/null 2>&1; then
  apt-get install -y docker.io
fi
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-v2 || apt-get install -y docker-compose-plugin
fi

systemctl enable --now docker
mkdir -p "$ROOT/system" "$STEEL_DIR/cache"

# Steel self-host: API and CDP are loopback-only.
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
docker compose pull
docker compose up -d

echo "Steel container status:"
docker ps --filter name=norizo-steel --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "Steel remains loopback-only on ports 3000 and 9223."
