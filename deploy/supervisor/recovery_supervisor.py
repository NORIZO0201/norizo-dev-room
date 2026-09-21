#!/usr/bin/env python3
"""NORIZO DEV ROOM recovery supervisor.

Purpose
-------
Keep the declared resident units enabled and active without depending on any
external scheduler (ChatGPT Automation, a laptop, or a human SSH session).
systemd runs this as a short one-shot pass on a timer, so the supervisor and
the units it repairs are not in the same failure domain.

Safety contract
---------------
- It only ever runs ``systemctl enable`` / ``systemctl start`` / ``restart``.
- It never stops, disables, masks or unmasks anything.
- A masked unit is reported, never touched: unmasking is a human decision.
- ``ExecMainStatus=75`` means HOLD / human review and is never restart-looped.
- Repeated failed recovery attempts are throttled instead of storming.
- Every decision and every corrective action is appended to an audit log.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(os.environ.get("NORIZO_ROOT", "/opt/norizo"))
SYSTEM_DIR = ROOT / "system"
STATE_FILE = SYSTEM_DIR / "supervisor-state.json"
STATUS_FILE = SYSTEM_DIR / "supervisor-status.json"
LOG_DIR = Path(os.environ.get("NORIZO_LOG_DIR", "/var/log/norizo"))
LOG_FILE = LOG_DIR / "supervisor.jsonl"

DEFAULT_CONFIG = Path(
    os.environ.get("NORIZO_DESIRED_STATE", "/etc/norizo/desired-state.json")
)
FALLBACK_CONFIG = Path(__file__).resolve().parent / "desired-state.json"

# Recovery attempts allowed per unit inside THROTTLE_WINDOW seconds.
THROTTLE_MAX = 3
THROTTLE_WINDOW = 3600
# How long a throttled unit stays held before the supervisor tries again.
HOLD_SECONDS = 21600

HOLD_EXIT_CODE = "75"

SHOW_PROPERTIES = (
    "LoadState",
    "UnitFileState",
    "ActiveState",
    "SubState",
    "Result",
    "ExecMainStatus",
)


def now() -> float:
    return time.time()


def iso(ts: float | None = None) -> str:
    return datetime.fromtimestamp(ts if ts is not None else now(), timezone.utc).isoformat()


def run(cmd: list[str], timeout: float = 20.0) -> tuple[int, str, str]:
    try:
        proc = subprocess.run(
            cmd, check=False, capture_output=True, text=True, timeout=timeout
        )
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except (OSError, subprocess.SubprocessError) as exc:  # pragma: no cover - host dependent
        return 127, "", str(exc)


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def write_json_atomic(path: Path, payload: Any) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
        os.replace(tmp, path)
    except OSError:
        pass


def audit(event: dict[str, Any]) -> None:
    """Append one immutable audit record. Never raises."""
    record = {"ts": iso(), **event}
    line = json.dumps(record, ensure_ascii=False)
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError:
        pass
    print(line, flush=True)


def unit_state(unit: str) -> dict[str, str]:
    args = ["systemctl", "show"]
    for prop in SHOW_PROPERTIES:
        args += ["-p", prop]
    args.append(unit)
    code, out, _ = run(args, 10.0)
    if code not in (0, 1, 3, 4):
        return {"LoadState": "unknown"}
    parsed: dict[str, str] = {}
    for line in out.splitlines():
        key, _, value = line.partition("=")
        if key:
            parsed[key] = value
    return parsed


class Throttle:
    """Per-unit recovery budget, persisted across supervisor passes."""

    def __init__(self, raw: Any) -> None:
        self.data: dict[str, dict[str, Any]] = {}
        if isinstance(raw, dict) and isinstance(raw.get("units"), dict):
            for name, entry in raw["units"].items():
                if isinstance(entry, dict):
                    attempts = entry.get("attempts")
                    self.data[name] = {
                        "attempts": [
                            float(a) for a in attempts if isinstance(a, (int, float))
                        ]
                        if isinstance(attempts, list)
                        else [],
                        "hold_until": float(entry.get("hold_until") or 0.0),
                    }

    def entry(self, unit: str) -> dict[str, Any]:
        return self.data.setdefault(unit, {"attempts": [], "hold_until": 0.0})

    def held_until(self, unit: str) -> float:
        entry = self.entry(unit)
        return entry["hold_until"] if entry["hold_until"] > now() else 0.0

    def allow(self, unit: str) -> bool:
        entry = self.entry(unit)
        cutoff = now() - THROTTLE_WINDOW
        entry["attempts"] = [a for a in entry["attempts"] if a >= cutoff]
        return len(entry["attempts"]) < THROTTLE_MAX

    def record_attempt(self, unit: str) -> None:
        self.entry(unit)["attempts"].append(now())

    def hold(self, unit: str) -> float:
        entry = self.entry(unit)
        entry["hold_until"] = now() + HOLD_SECONDS
        return entry["hold_until"]

    def clear(self, unit: str) -> None:
        self.data[unit] = {"attempts": [], "hold_until": 0.0}

    def dump(self) -> dict[str, Any]:
        return {"version": 1, "units": self.data}


def check_unit(spec: dict[str, Any], throttle: Throttle, dry_run: bool) -> dict[str, Any]:
    name = str(spec.get("name", "")).strip()
    mode = str(spec.get("mode", "daemon"))
    required = bool(spec.get("required", False))
    report: dict[str, Any] = {"unit": name, "mode": mode, "actions": []}

    if not name:
        report["state"] = "invalid"
        return report

    state = unit_state(name)
    load = state.get("LoadState", "unknown")
    file_state = state.get("UnitFileState", "")
    active = state.get("ActiveState", "unknown")
    exec_status = state.get("ExecMainStatus", "")
    report.update(
        {
            "load_state": load,
            "unit_file_state": file_state,
            "active_state": active,
            "sub_state": state.get("SubState", ""),
        }
    )

    if load == "masked" or file_state == "masked":
        report["state"] = "masked"
        report["needs_human"] = True
        audit(
            {
                "event": "unit_masked",
                "unit": name,
                "detail": "masked units are never unmasked automatically",
            }
        )
        return report

    if load != "loaded":
        report["state"] = "missing" if required else "not_installed"
        report["needs_human"] = required
        if required:
            audit({"event": "unit_missing", "unit": name, "load_state": load})
        return report

    if active == "failed" and exec_status == HOLD_EXIT_CODE:
        report["state"] = "hold_exit_75"
        report["needs_human"] = True
        audit(
            {
                "event": "unit_hold_exit_75",
                "unit": name,
                "detail": "exit 75 means HOLD / human review; no restart attempted",
            }
        )
        return report

    want_active = mode in ("daemon", "timer")
    active_ok = active in ("active", "activating", "reloading")
    enable_ok = file_state not in ("disabled", "")
    healthy = enable_ok and (active_ok or not want_active)

    if healthy:
        report["state"] = "ok"
        if throttle.entry(name)["attempts"] or throttle.entry(name)["hold_until"]:
            throttle.clear(name)
            audit({"event": "unit_recovered", "unit": name})
        return report

    hold_until = throttle.held_until(name)
    if hold_until:
        report["state"] = "held"
        report["hold_until"] = iso(hold_until)
        report["needs_human"] = True
        return report

    if not throttle.allow(name):
        hold_until = throttle.hold(name)
        report["state"] = "held"
        report["hold_until"] = iso(hold_until)
        report["needs_human"] = True
        audit(
            {
                "event": "unit_held_throttled",
                "unit": name,
                "detail": "%d recovery attempts within %ds did not hold"
                % (THROTTLE_MAX, THROTTLE_WINDOW),
                "hold_until": iso(hold_until),
            }
        )
        return report

    report["state"] = "repairing"

    if file_state == "disabled":
        if dry_run:
            report["actions"].append({"action": "enable", "dry_run": True})
        else:
            throttle.record_attempt(name)
            code, _, err = run(["systemctl", "enable", name], 30.0)
            report["actions"].append({"action": "enable", "code": code, "error": err})
            audit(
                {
                    "event": "unit_enable",
                    "unit": name,
                    "code": code,
                    "reason": "declared resident unit was disabled",
                    "error": err,
                }
            )

    if want_active and not active_ok:
        verb = "restart" if active == "failed" else "start"
        if dry_run:
            report["actions"].append({"action": verb, "dry_run": True})
        else:
            throttle.record_attempt(name)
            code, _, err = run(["systemctl", verb, name], 90.0)
            report["actions"].append({"action": verb, "code": code, "error": err})
            audit(
                {
                    "event": "unit_%s" % verb,
                    "unit": name,
                    "code": code,
                    "reason": "declared resident unit was %s" % active,
                    "error": err,
                }
            )

    after = unit_state(name)
    report["active_state_after"] = after.get("ActiveState", "unknown")
    report["unit_file_state_after"] = after.get("UnitFileState", "")
    return report


def check_freshness(spec: dict[str, Any]) -> dict[str, Any]:
    """Report (never repair) heartbeat files that stopped being updated."""
    path = Path(str(spec.get("path", "")))
    label = str(spec.get("label") or path.name)
    max_age = float(spec.get("max_age_seconds") or 0)
    report: dict[str, Any] = {"label": label, "path": str(path), "max_age_seconds": max_age}

    if not path.exists():
        report["state"] = "missing"
        return report

    age: float | None = None
    payload = load_json(path)
    if isinstance(payload, dict) and isinstance(payload.get("updated_at"), str):
        try:
            stamped = datetime.fromisoformat(payload["updated_at"])
            if stamped.tzinfo is None:
                stamped = stamped.replace(tzinfo=timezone.utc)
            age = now() - stamped.timestamp()
        except ValueError:
            age = None
    if age is None:
        try:
            age = now() - path.stat().st_mtime
        except OSError:
            report["state"] = "unreadable"
            return report

    report["age_seconds"] = round(age, 1)
    if max_age and age > max_age:
        report["state"] = "stale"
        report["needs_human"] = True
        audit(
            {
                "event": "heartbeat_stale",
                "label": label,
                "path": str(path),
                "age_seconds": round(age, 1),
                "max_age_seconds": max_age,
            }
        )
    else:
        report["state"] = "fresh"
    return report


def load_config(path: Path) -> dict[str, Any] | None:
    for candidate in (path, FALLBACK_CONFIG):
        payload = load_json(candidate)
        if isinstance(payload, dict) and isinstance(payload.get("units"), list):
            payload["_source"] = str(candidate)
            return payload
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="NORIZO DEV ROOM recovery supervisor")
    parser.add_argument(
        "--config", default=str(DEFAULT_CONFIG), help="desired-state JSON path"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report what would be repaired without changing any unit",
    )
    args = parser.parse_args()

    config = load_config(Path(args.config))
    if config is None:
        audit({"event": "config_unreadable", "path": args.config})
        return 2

    throttle = Throttle(load_json(STATE_FILE))

    units = [check_unit(spec, throttle, args.dry_run) for spec in config["units"] if isinstance(spec, dict)]
    heartbeats = [
        check_freshness(spec)
        for spec in config.get("freshness", [])
        if isinstance(spec, dict)
    ]

    repaired = sum(1 for u in units if u.get("actions"))
    attention = [u["unit"] for u in units if u.get("needs_human")]
    attention += [h["label"] for h in heartbeats if h.get("needs_human")]

    status = {
        "generated_at": iso(),
        "config_source": config.get("_source"),
        "dry_run": args.dry_run,
        "units": units,
        "heartbeats": heartbeats,
        "repaired_count": repaired,
        "needs_human": attention,
    }

    if not args.dry_run:
        write_json_atomic(STATE_FILE, throttle.dump())
    write_json_atomic(STATUS_FILE, status)

    audit(
        {
            "event": "pass_complete",
            "dry_run": args.dry_run,
            "units_checked": len(units),
            "repaired": repaired,
            "needs_human": attention,
        }
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
