#!/usr/bin/env bash
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "must run as root" >&2; exit 1; }
REPO_DIR="${REPO_DIR:-/opt/norizo/norizo-dev-room}"
SRC="$REPO_DIR/deploy/supervisor"
LOG_DIR="${NORIZO_LOG_DIR:-/var/log/norizo}"
CONFIG_DST=/etc/norizo/desired-state.json
for f in recovery_supervisor.py desired-state.json norizo-supervisor.service norizo-supervisor.timer; do [ -f "$SRC/$f" ] || exit 2; done
install -d -m 0755 "$LOG_DIR" /opt/norizo/system
install -d -m 0700 /etc/norizo
install -m 0644 "$SRC/desired-state.json" "$CONFIG_DST"
install -m 0644 "$SRC/norizo-supervisor.service" /etc/systemd/system/norizo-supervisor.service
install -m 0644 "$SRC/norizo-supervisor.timer" /etc/systemd/system/norizo-supervisor.timer
systemctl daemon-reload
NORIZO_DESIRED_STATE="$CONFIG_DST" python3 "$SRC/recovery_supervisor.py" --dry-run
systemctl enable --now norizo-supervisor.timer
