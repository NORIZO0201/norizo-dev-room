#!/usr/bin/env bash
set -uo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "must run as root" >&2; exit 1; fi
ROOT="${NORIZO_ROOT:-/opt/norizo}"
DEVROOM="${REPO_DIR:-$ROOT/norizo-dev-room}"
EXECUTOR="$DEVROOM/scripts/execute-p1-p5.sh"
PHASE_DIR="$ROOT/system/phases"
RUN_FILE="$PHASE_DIR/executor-run.json"
LOG_DIR="${NORIZO_LOG_DIR:-/var/log/norizo}"
LOG_FILE="$LOG_DIR/executor.jsonl"
LOCK_FILE="/run/norizo-p1-p5.lock"
HOLD=75
mkdir -p "$PHASE_DIR" "$LOG_DIR"
STARTED_AT="$(python3 -c 'from datetime import datetime, timezone; print(datetime.now(timezone.utc).isoformat())')"
log_json() {
python3 - "$LOG_FILE" "$RUN_FILE" "$1" "$2" "$3" "$STARTED_AT" <<'PY'
import json, os, sys, tempfile
from datetime import datetime, timezone
log_path, run_path, state, code, detail, started_at = sys.argv[1:]
record={"started_at":started_at,"finished_at":datetime.now(timezone.utc).isoformat(),"state":state,"exit_code":int(code),"detail":detail,"updated_at":datetime.now(timezone.utc).isoformat()}
with open(log_path,"a",encoding="utf-8") as f: f.write(json.dumps(record,ensure_ascii=False)+"\n")
fd,tmp=tempfile.mkstemp(prefix=".executor-run-",dir=os.path.dirname(run_path))
with os.fdopen(fd,"w") as f: json.dump(record,f,ensure_ascii=False,indent=2); f.write("\n")
os.replace(tmp,run_path)
PY
}
[ -f "$EXECUTOR" ] || { log_json hold "$HOLD" "executor missing"; exit "$HOLD"; }
exec 9>"$LOCK_FILE"
if ! flock -n 9; then log_json skipped 0 "previous run active"; exit 0; fi
bash "$EXECUTOR"; code=$?
if [ "$code" -eq 0 ]; then log_json ok 0 "P1-P5 pass complete"
elif [ "$code" -eq "$HOLD" ]; then log_json hold "$code" "phase gate HOLD"
else log_json failed "$code" "executor failed"; fi
exit "$code"
