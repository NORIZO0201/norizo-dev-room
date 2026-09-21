#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "root required" >&2; exit 1; fi
ROOT=/opt/norizo/norizo-dev-room
install -d -m 700 /etc/norizo
install -m 644 "$ROOT/deploy/control-plane/norizo-control-agent.service" /etc/systemd/system/norizo-control-agent.service
systemctl daemon-reload
systemctl enable --now norizo-control-agent.service
sleep 2
systemctl --no-pager --full status norizo-control-agent.service || true
