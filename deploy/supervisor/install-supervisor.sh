#!/usr/bin/env bash
set -euo pipefail

# Installs the DEV ROOM recovery supervisor on the existing ConoHa VPS.
# Additive and idempotent: it installs a timer plus a one-shot service and
# never stops, disables or removes anything that is already running.

if [ "$(id -u)" -ne 0 ]; then
  echo "This installer must run as root." >&2
  exit 1
fi

REPO_DIR="${REPO_DIR:-/opt/norizo/norizo-dev-room}"
SRC="$REPO_DIR/deploy/supervisor"
LOG_DIR="${NORIZO_LOG_DIR:-/var/log/norizo}"
CONFIG_DST="/etc/norizo/desired-state.json"

for required in \
  "$SRC/recovery_supervisor.py" \
  "$SRC/desired-state.json" \
  "$SRC/norizo-supervisor.service" \
  "$SRC/norizo-supervisor.timer"; do
  if [ ! -f "$required" ]; then
    echo "Missing required file: $required" >&2
    exit 2
  fi
done

install -d -m 0755 "$LOG_DIR"
install -d -m 0700 /etc/norizo
install -d -m 0755 /opt/norizo/system

# An operator-edited desired state is never overwritten by an upgrade.
if [ -f "$CONFIG_DST" ]; then
  echo "Keeping existing $CONFIG_DST (edit it by hand to change managed units)."
else
  install -m 0644 "$SRC/desired-state.json" "$CONFIG_DST"
  echo "Installed default desired state at $CONFIG_DST"
fi

chmod 0755 "$SRC/recovery_supervisor.py"
install -m 0644 "$SRC/norizo-supervisor.service" /etc/systemd/system/norizo-supervisor.service
install -m 0644 "$SRC/norizo-supervisor.timer" /etc/systemd/system/norizo-supervisor.timer

systemctl daemon-reload

# Prove the supervisor is safe on this host before arming the timer.
echo "== dry run =="
NORIZO_DESIRED_STATE="$CONFIG_DST" python3 "$SRC/recovery_supervisor.py" --dry-run

systemctl enable --now norizo-supervisor.timer

echo
systemctl --no-pager --full list-timers norizo-supervisor.timer || true
echo
echo "Audit log:   $LOG_DIR/supervisor.jsonl"
echo "Status file: /opt/norizo/system/supervisor-status.json"
