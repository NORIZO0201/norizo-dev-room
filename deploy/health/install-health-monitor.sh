#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "This installer must run as root." >&2
  exit 1
fi

REPO_DIR="${REPO_DIR:-/opt/norizo/norizo-dev-room}"
TARGET_DIR="/opt/norizo/system/health"
UNIT_SRC="$REPO_DIR/deploy/health/norizo-health.service"
PY_SRC="$REPO_DIR/deploy/health/health_server.py"
UNIT_DST="/etc/systemd/system/norizo-health.service"

for required in "$UNIT_SRC" "$PY_SRC"; do
  if [ ! -f "$required" ]; then
    echo "Missing required file: $required" >&2
    exit 2
  fi
done

install -d -m 0755 "$TARGET_DIR"
install -m 0755 "$PY_SRC" "$TARGET_DIR/health_server.py"
install -m 0644 "$UNIT_SRC" "$UNIT_DST"

systemctl daemon-reload
systemctl enable --now norizo-health.service

sleep 1
curl --fail --silent --show-error http://127.0.0.1:8787/health >/dev/null
systemctl --no-pager --full status norizo-health.service | sed -n '1,12p'

echo "Health endpoint: http://127.0.0.1:8787/health"
echo "Snapshot file:   $TARGET_DIR/status.json"
