#!/usr/bin/env bash
set -euo pipefail

# NORIZO DEV ROOM P1-P5 executor.
# Safe-by-default: no production web deployment, no public ports, no destructive repo reset.
# Run as root on the existing ConoHa VPS.

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root." >&2
  exit 1
fi

ROOT=/opt/norizo
DEVROOM="$ROOT/norizo-dev-room"
SYSTEM="$ROOT/system"
STATUS_DIR="$SYSTEM/phases"
ENABLE_STEEL="${ENABLE_STEEL:-0}"
EXECUTE_BUILDS="${EXECUTE_BUILDS:-0}"

mkdir -p "$STATUS_DIR"

stamp() {
  local phase="$1" state="$2" detail="$3"
  python3 - "$STATUS_DIR/$phase.json" "$phase" "$state" "$detail" <<'PY'
import json, os, sys, tempfile
from datetime import datetime, timezone
path, phase, state, detail = sys.argv[1:]
doc = {"phase": phase, "state": state, "detail": detail, "updated_at": datetime.now(timezone.utc).isoformat()}
fd, tmp = tempfile.mkstemp(prefix=".phase-", dir=os.path.dirname(path))
with os.fdopen(fd, "w") as f:
    json.dump(doc, f, ensure_ascii=False, indent=2)
    f.write("\n")
os.replace(tmp, path)
PY
}

need_repo() {
  local name="$1"
  test -d "$ROOT/$name/.git" || { stamp "$2" "blocked" "missing repo: $name"; return 1; }
  return 0
}

echo "== P1 Common Health Monitor =="
bash "$DEVROOM/deploy/health/install-health-monitor.sh"
curl -fsS http://127.0.0.1:8787/health >/dev/null
stamp P1 healthy "norizo-health.service active; loopback health endpoint verified"

echo "== P2 OMNW resident-worker readiness =="
if need_repo oh-my-nihon-wine P2; then
  OMNW="$ROOT/oh-my-nihon-wine"
  git -C "$OMNW" status --short
  if [ -f "$OMNW/package.json" ] && [ -f "$OMNW/scripts/qa-recognition.ts" ]; then
    stamp P2 staged "OMNW repo present; QA recognition entrypoint found; resident discovery launcher still requires audited deterministic entrypoint"
  else
    stamp P2 blocked "OMNW resident entrypoint audit incomplete"
  fi
fi

echo "== P3 Steel self-host =="
if [ "$ENABLE_STEEL" = "1" ]; then
  INSTALL_HEALTH=0 INSTALL_STEEL=1 bash "$DEVROOM/scripts/bootstrap-conoha.sh"
  curl -fsS http://127.0.0.1:3000/api/health >/dev/null
  stamp P3 healthy "Steel self-host enabled on loopback only"
else
  stamp P3 deferred "intentionally deferred until a browser-dependent workload is proven"
fi

echo "== P4 RELIS / LOCAL ENGINE observation readiness =="
if need_repo local-engine P4; then
  stamp P4 staged "local-engine repo present; observation worker must reuse P2 worker contract before activation"
fi

echo "== P5 deterministic batches =="
missing=()
for r in sayaka-kitchen craft-nihon-wine; do
  test -d "$ROOT/$r/.git" || missing+=("$r")
done
if [ "${#missing[@]}" -gt 0 ]; then
  stamp P5 blocked "missing repos: ${missing[*]}"
else
  if [ "$EXECUTE_BUILDS" = "1" ]; then
    (cd "$ROOT/sayaka-kitchen" && npm ci && npm run build)
    (cd "$ROOT/craft-nihon-wine" && npm ci && npm run lint && npm test && npm run build)
    stamp P5 healthy "SAYAKA and CNW deterministic QA/build passed"
  else
    stamp P5 staged "repos present; deterministic QA/build commands defined; execution gated by EXECUTE_BUILDS=1"
  fi
fi

echo
echo "== Phase status =="
for f in "$STATUS_DIR"/P{1,2,3,4,5}.json; do
  [ -f "$f" ] && cat "$f"
done

echo
echo "No Vercel production deployment was performed."
echo "No production website was modified."
