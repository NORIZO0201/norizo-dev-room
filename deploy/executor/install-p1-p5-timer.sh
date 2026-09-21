#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "This installer must run as root." >&2
  exit 1
fi

REPO_DIR="${REPO_DIR:-/opt/norizo/norizo-dev-room}"
SRC="$REPO_DIR/deploy/executor"
WRAPPER="$REPO_DIR/scripts/run-p1-p5-executor.sh"
EXECUTOR="$REPO_DIR/scripts/execute-p1-p5.sh"

for required in "$SRC/norizo-p1-p5.service" "$SRC/norizo-p1-p5.timer" "$WRAPPER" "$EXECUTOR"; do
  [ -f "$required" ] || { echo "Missing required file: $required" >&2; exit 75; }
done

install -d -m 0755 "${NORIZO_LOG_DIR:-/var/log/norizo}"
install -m 0644 "$SRC/norizo-p1-p5.service" /etc/systemd/system/norizo-p1-p5.service
install -m 0644 "$SRC/norizo-p1-p5.timer" /etc/systemd/system/norizo-p1-p5.timer
systemctl daemon-reload
systemctl enable --now norizo-p1-p5.timer
systemctl --no-pager --full list-timers norizo-p1-p5.timer || true
