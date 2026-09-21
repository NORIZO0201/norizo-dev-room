#!/usr/bin/env bash
set -uo pipefail

# Resident wrapper around scripts/execute-p1-p5.sh.
#
# The P1-P5 executor itself is a one-shot script with no schedule of its own.
# Before this wrapper the only thing that ever invoked it was an external
# ChatGPT Automation task, so disabling that task silently ended all P1-P5
# execution with no local trace. This wrapper gives the executor a local
# schedule, a run record and an append-only audit log on the VPS.
#
# It deliberately does not use `set -e`: a failing phase must still be
# recorded, not abort the wrapper before it writes evidence.

if [ "$(id -u)" -ne 0 ]; then
  echo "This wrapper must run as root." >&2
  exit 1
fi

ROOT="${NORIZO_ROOT:-/opt/norizo}"
DEVROOM="${REPO_DIR:-$ROOT/norizo-dev-room}"
EXECUTOR="$DEVROOM/scripts/execute-p1-p5.sh"
PHASE_DIR="$ROOT/system/phases"
RUN_FILE="$PHASE_DIR/executor-run.json"
LOG_DIR="${NORIZO_LOG_DIR:-/var/log/norizo}"
LOG_FILE="$LOG_DIR/executor.jsonl"
LOCK_FILE="/run/norizo-p1-p5.lock"

# Exit 75 is the project-wide "HOLD / human review" code. It must never be
# treated as a transient failure and must never be restart-looped.
HOLD=75

mkdir -p "$PHASE_DIR" "$LOG_DIR"

log_json() {
  # log_json <state> <exit_code> <detail>
  python3 - "$LOG_FILE" "$RUN_FILE" "$1" "$2" "$3" "$STARTED_AT" <<'PY'
import json, os, sys, tempfile
from datetime import datetime, timezone

log_path, run_path, state, code, detail, started_at = sys.argv[1:]
record = {
    "started_at": started_at,
    "finished_at": datetime.now(timezone.utc).isoformat(),
    "state": state,
    "exit_code": int(code),
    "detail": detail,
    "updated_at": datetime.now(timezone.utc).isoformat(),
}
try:
    with open(log_path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
except OSError:
    pass
fd, tmp = tempfile.mkstemp(prefix=".executor-run-", dir=os.path.dirname(run_path))
with os.fdopen(fd, "w") as handle:
    json.dump(record, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
os.replace(tmp, run_path)
PY
}

STARTED_AT="$(python3 -c 'from datetime import datetime, timezone; print(datetime.now(timezone.utc).isoformat())')"

if [ ! -x "$EXECUTOR" ] && [ ! -f "$EXECUTOR" ]; then
  echo "HOLD: $EXECUTOR is not present in this checkout." >&2
  echo "Merge the P1-P5 executor branch before arming norizo-p1-p5.timer." >&2
  log_json hold "$HOLD" "executor script missing: $EXECUTOR"
  exit "$HOLD"
fi

# flock prevents a slow run from overlapping the next timer firing.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Previous P1-P5 run still in progress; skipping this firing." >&2
  log_json skipped 0 "previous run still holding $LOCK_FILE"
  exit 0
fi

bash "$EXECUTOR"
code=$?

if [ "$code" -eq 0 ]; then
  log_json ok 0 "P1-P5 executor completed"
elif [ "$code" -eq "$HOLD" ]; then
  log_json hold "$code" "P1-P5 executor returned HOLD (75); human review required"
else
  log_json failed "$code" "P1-P5 executor failed"
fi

exit "$code"
