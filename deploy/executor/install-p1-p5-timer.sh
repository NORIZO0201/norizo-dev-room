#!/usr/bin/env bash
set -euo pipefail

# Installs the resident P1-P5 executor schedule on the existing ConoHa VPS.
#
# Arming this timer makes the VPS run the P1-P5 executor by itself every hour
# as root, so it is an explicit opt-in rather than a side effect of any other
# install step.

if [ "$(id -u)" -ne 0 ]; then
  echo "This installer must run as root." >&2
  exit 1
fi

if [ "${NORIZO_ENABLE_P1_P5_TIMER:-0}" != "1" ]; then
  echo "HOLD: arming the resident P1-P5 executor is an explicit decision." >&2
  echo "Re-run with NORIZO_ENABLE_P1_P5_TIMER=1 once you want the VPS to" >&2
  echo "execute P1-P5 on its own schedule." >&2
  exit 75
fi

REPO_DIR="${REPO_DIR:-/opt/norizo/norizo-dev-room}"
SRC="$REPO_DIR/deploy/executor"
WRAPPER="$REPO_DIR/scripts/run-p1-p5-executor.sh"
EXECUTOR="$REPO_DIR/scripts/execute-p1-p5.sh"

for required in \
  "$SRC/norizo-p1-p5.service" \
  "$SRC/norizo-p1-p5.timer" \
  "$WRAPPER"; do
  if [ ! -f "$required" ]; then
    echo "Missing required file: $required" >&2
    exit 2
  fi
done

if [ ! -f "$EXECUTOR" ]; then
  echo "HOLD: $EXECUTOR is not in this checkout." >&2
  echo "Merge the P1-P5 executor branch first, then re-run this installer." >&2
  exit 75
fi

chmod 0755 "$WRAPPER"
install -d -m 0755 "${NORIZO_LOG_DIR:-/var/log/norizo}"
install -m 0644 "$SRC/norizo-p1-p5.service" /etc/systemd/system/norizo-p1-p5.service
install -m 0644 "$SRC/norizo-p1-p5.timer" /etc/systemd/system/norizo-p1-p5.timer

systemctl daemon-reload
systemctl enable --now norizo-p1-p5.timer

echo
systemctl --no-pager --full list-timers norizo-p1-p5.timer || true
echo
echo "Run record: /opt/norizo/system/phases/executor-run.json"
echo "Audit log:  ${NORIZO_LOG_DIR:-/var/log/norizo}/executor.jsonl"
echo "Trigger one pass now with: systemctl start norizo-p1-p5.service"
