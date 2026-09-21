#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'EOF'
RETIRED: the DEV ROOM VPS/systemd health monitor is permanently disabled.
ConoHa/VPS must not be inspected, started, provisioned, or recreated.
Use state/DEV_ROOM_STATE.json plus the provider API health gates instead.
EOF
exit 78
