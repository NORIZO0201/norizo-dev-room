#!/usr/bin/env bash
set -euo pipefail
ROOT=/opt/norizo/norizo-dev-room
chmod 755 "$ROOT/deploy/orchestrator/claude_orchestrator.py"
install -m 644 "$ROOT/deploy/orchestrator/norizo-claude-orchestrator.service" /etc/systemd/system/norizo-claude-orchestrator.service
systemctl daemon-reload
systemctl enable --now norizo-claude-orchestrator.service
systemctl --no-pager --full status norizo-claude-orchestrator.service || true
