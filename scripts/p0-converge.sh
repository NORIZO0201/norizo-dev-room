#!/usr/bin/env bash
set -euo pipefail

# One-shot P0 host convergence after the required ConoHa snapshot exists.
# This script deliberately refuses to run unless the caller confirms that
# snapshot protection has already been created outside this script.

if [ "$(id -u)" -ne 0 ]; then
  echo "P0 convergence must run as root." >&2
  exit 1
fi

if [ "${NORIZO_SNAPSHOT_CONFIRMED:-0}" != "1" ]; then
  echo "P0 HOLD: create/confirm the ConoHa snapshot first, then set NORIZO_SNAPSHOT_CONFIRMED=1." >&2
  exit 75
fi

ROOT=/opt/norizo
DEVROOM="$ROOT/norizo-dev-room"
REF="${DEVROOM_REF:-dev-room-p0-p5}"

# bootstrap-conoha.sh is branch-safe and installs/verifies health before any
# resident control worker is started.
DEVROOM_REF="$REF" bash "$DEVROOM/scripts/bootstrap-conoha.sh"

python3 -m json.tool "$ROOT/system/baseline.json" >/dev/null
systemctl is-active --quiet norizo-health.service
curl --fail --silent --show-error http://127.0.0.1:8787/health >/dev/null

bash "$DEVROOM/deploy/control-plane/install-control-agent.sh"
systemctl is-enabled --quiet norizo-control-agent.service
systemctl is-active --quiet norizo-control-agent.service

# The agent creates this token only after the IP-gated Supabase bootstrap has
# succeeded. Wait briefly so transient network startup does not look like a
# deterministic failure.
for _ in $(seq 1 18); do
  if [ -s /etc/norizo/node-token ]; then
    break
  fi
  sleep 5
done

if [ ! -s /etc/norizo/node-token ]; then
  echo "P0 HOLD: control agent is active but node token was not created within 90 seconds." >&2
  journalctl -u norizo-control-agent.service -n 40 --no-pager >&2 || true
  exit 75
fi

# Refresh the durable baseline after the control agent is installed so its
# systemd state and token-file presence are captured in the evidence file.
python3 "$DEVROOM/scripts/write-baseline.py"
python3 -m json.tool "$ROOT/system/baseline.json" >/dev/null

systemctl is-active --quiet norizo-health.service
systemctl is-active --quiet norizo-control-agent.service
curl --fail --silent --show-error http://127.0.0.1:8787/status >/dev/null

echo "P0 host-side convergence complete."
echo "Remaining remote gates: fresh Supabase telemetry and one safe command round-trip."
