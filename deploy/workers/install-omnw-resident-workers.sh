#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "root required" >&2
  exit 1
fi

ROOT="${NORIZO_ROOT:-/opt/norizo}"
SRC="$ROOT/norizo-dev-room/deploy/workers"
STATE="$ROOT/system/workers"

for required in \
  "$SRC/omnw_resident_worker.py" \
  "$SRC/omnw-discovery.service" \
  "$SRC/omnw-master.service"
do
  [ -f "$required" ] || { echo "missing required file: $required" >&2; exit 75; }
done

[ -s /etc/norizo/node-token ] || { echo "DEV ROOM node token missing" >&2; exit 75; }
install -d -m 0755 "$STATE"
install -m 0644 "$SRC/omnw-discovery.service" /etc/systemd/system/omnw-discovery.service
install -m 0644 "$SRC/omnw-master.service" /etc/systemd/system/omnw-master.service
systemctl daemon-reload
systemctl enable --now omnw-discovery.service omnw-master.service

sleep 3
systemctl is-active --quiet omnw-discovery.service
systemctl is-active --quiet omnw-master.service

printf 'OMNW resident workers active: discovery=%s master=%s\n' \
  "$(systemctl is-active omnw-discovery.service)" \
  "$(systemctl is-active omnw-master.service)"
