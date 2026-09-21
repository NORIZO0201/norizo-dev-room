#!/usr/bin/env python3
"""Write a non-secret baseline inventory for the NORIZO LAB ConoHa batch host."""

from __future__ import annotations

import json
import os
import platform
import shutil
import socket
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(os.environ.get("NORIZO_ROOT", "/opt/norizo"))
OUT = ROOT / "system" / "baseline.json"

KNOWN_REPOS = (
    "norizo-dev-room",
    "oh-my-nihon-wine",
    "local-engine",
    "sayaka-kitchen",
)

KNOWN_UNITS = (
    "norizo-health.service",
    "omnw-discovery.service",
    "omnw-recognition.service",
    "omnw-master.service",
    "omnw-m0-m5.service",
)

TOOLS = (
    ("git", ["git", "--version"]),
    ("python3", ["python3", "--version"]),
    ("node", ["node", "--version"]),
    ("docker", ["docker", "--version"]),
    ("docker_compose", ["docker", "compose", "version"]),
    ("jq", ["jq", "--version"]),
    ("rg", ["rg", "--version"]),
)


def run(cmd: list[str], timeout: float = 5.0) -> tuple[int, str]:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)
        return p.returncode, (p.stdout or p.stderr).strip()
    except Exception:
        return 127, ""


def versions() -> dict:
    out = {}
    for name, cmd in TOOLS:
        code, text = run(cmd)
        out[name] = {
            "present": code == 0,
            "version": text.splitlines()[0] if code == 0 and text else None,
            "path": shutil.which(cmd[0]),
        }
    return out


def units() -> dict:
    if not shutil.which("systemctl"):
        return {}
    result = {}
    for unit in KNOWN_UNITS:
        _, text = run(["systemctl", "is-active", unit], 2)
        result[unit] = text or "unknown"
    return result


def repos() -> list[dict]:
    result = []
    for name in KNOWN_REPOS:
        path = ROOT / name
        item = {"name": name, "present": (path / ".git").is_dir()}
        if item["present"]:
            _, branch = run(["git", "-C", str(path), "branch", "--show-current"])
            _, head = run(["git", "-C", str(path), "rev-parse", "HEAD"])
            _, dirty = run(["git", "-C", str(path), "status", "--porcelain"])
            item.update(branch=branch or None, head=head or None, dirty=bool(dirty))
        result.append(item)
    return result


def docker_state() -> dict:
    if not shutil.which("docker"):
        return {"available": False}
    code, text = run(["docker", "ps", "--format", "{{.Names}}\t{{.Status}}"], 8)
    if code != 0:
        return {"available": True, "reachable": False}
    containers = []
    for line in text.splitlines():
        if not line:
            continue
        name, _, status = line.partition("\t")
        containers.append({"name": name, "status": status})
    return {"available": True, "reachable": True, "containers": containers}


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema_version": 2,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "node": "conoha-01",
        "host": {
            "hostname": socket.gethostname(),
            "kernel": platform.release(),
            "architecture": platform.machine(),
            "cpu_logical": os.cpu_count(),
        },
        "tools": versions(),
        "units": units(),
        "docker": docker_state(),
        "repos": repos(),
        "policy": {
            "command_origin": "chatty",
            "github_ai_dispatch": False,
            "resident_ai_orchestrator": False,
            "resident_jobs_migrated_one_by_one": True,
            "steel_selfhost_for_browser_qa": True,
        },
    }
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    os.replace(tmp, OUT)
    print(f"baseline: wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
