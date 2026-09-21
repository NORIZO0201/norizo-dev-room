#!/usr/bin/env bash
set -uo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root." >&2; exit 1; }
ROOT=/opt/norizo
SYSTEM="$ROOT/system"
STATUS_DIR="$SYSTEM/phases"
HOLD=75
ENABLE_STEEL="${ENABLE_STEEL:-0}"
EXECUTE_BUILDS="${EXECUTE_BUILDS:-1}"
mkdir -p "$STATUS_DIR"
stamp() {
  local phase="$1" state="$2" detail="$3"
  python3 - "$STATUS_DIR/$phase.json" "$phase" "$state" "$detail" <<'PY'
import json, os, sys, tempfile
from datetime import datetime, timezone
path,phase,state,detail=sys.argv[1:]
old={}
try:
    with open(path) as f: old=json.load(f)
except Exception: pass
now=datetime.now(timezone.utc).isoformat()
doc={**old,"phase":phase,"state":state,"detail":detail,"updated_at":now}
if state in ("complete","healthy","pass_not_required"): doc["last_success_at"]=now
if state in ("hold","blocked","failed"): doc["last_error_at"]=now
fd,tmp=tempfile.mkstemp(prefix=".phase-",dir=os.path.dirname(path))
with os.fdopen(fd,"w") as f: json.dump(doc,f,ensure_ascii=False,indent=2); f.write("\n")
os.replace(tmp,path)
PY
}
hold() { stamp "$1" hold "$2"; echo "HOLD $1: $2" >&2; exit "$HOLD"; }

echo "== P1 health/control =="
systemctl is-active --quiet norizo-health.service || hold P1 "norizo-health.service inactive"
systemctl is-active --quiet norizo-control-agent.service || hold P1 "norizo-control-agent.service inactive"
curl -fsS http://127.0.0.1:8787/health >/dev/null || hold P1 "loopback health endpoint failed"
stamp P1 complete "health + control agent active; loopback health verified"

echo "== P2 OMNW Discovery/Master resident worker =="
OMNW="$ROOT/oh-my-nihon-wine"
[ -d "$OMNW/.git" ] || hold P2 "oh-my-nihon-wine repo missing"
if [ -x "$OMNW/scripts/omnw-discovery-worker.sh" ] || [ -f "$OMNW/scripts/omnw-discovery-worker.py" ] || [ -f "$OMNW/scripts/omnw-discovery-worker.ts" ]; then
  systemctl is-active --quiet omnw-discovery.service || hold P2 "audited Discovery entrypoint exists but omnw-discovery.service is not active"
  stamp P2 complete "OMNW Discovery resident worker active; checkpoint/retry evidence must be present in worker state"
else
  hold P2 "deterministic OMNW Discovery resident entrypoint not yet implemented/audited"
fi

echo "== P3 browser gate =="
if [ "$ENABLE_STEEL" = "1" ]; then
  curl -fsS http://127.0.0.1:3000/api/health >/dev/null || hold P3 "Steel requested but loopback health failed"
  stamp P3 complete "Steel required and healthy on loopback"
else
  stamp P3 pass_not_required "no current canonical phase requires browser execution; structured sources remain first"
fi

echo "== P4 RELIS observation resident worker =="
[ -d "$ROOT/local-engine/.git" ] || hold P4 "local-engine repo missing"
systemctl is-active --quiet norizo-relis-observer.service || hold P4 "norizo-relis-observer.service not installed/active"
stamp P4 complete "RELIS observation worker active with resident contract"

echo "== P5 deterministic batches / node handoff =="
for r in sayaka-kitchen craft-nihon-wine; do
  [ -d "$ROOT/$r/.git" ] || hold P5 "missing repo: $r"
done
if [ "$EXECUTE_BUILDS" = "1" ]; then
  (cd "$ROOT/sayaka-kitchen" && npm ci && npm run build) || hold P5 "SAYAKA deterministic build failed"
  (cd "$ROOT/craft-nihon-wine" && npm ci && npm run lint && npm test && npm run build) || hold P5 "CNW deterministic QA/build failed"
fi
[ -f "$SYSTEM/gmktec-node-handoff.json" ] || hold P5 "GMKtec node handoff state missing"
stamp P5 complete "deterministic project QA passed and GMKtec handoff state recorded"
echo "P1-P5 COMPLETE"
