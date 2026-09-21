#!/usr/bin/env python3
"""Write the Phase 0 baseline inventory for the NORIZO AI WORK FACTORY.

Records what this host actually provides, so later phases can compare against a
known starting point instead of re-discovering it over SSH.

No secrets are read or recorded. Where a credential file matters to Phase 0, only
its presence is noted, never its contents.

Safe to run repeatedly and independently of scripts/bootstrap-conoha.sh.
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(os.environ.get("NORIZO_ROOT", "/opt/norizo"))
STATE_DIR = ROOT / "system"
BASELINE_FILE = STATE_DIR / "baseline.json"
HEALTH_URL = os.environ.get("NORIZO_HEALTH_URL", "http://127.0.0.1:8787/status")
NODE_ID = os.environ.get("NORIZO_NODE_ID", "conoha-01")
NODE_TOKEN_FILE = Path(os.environ.get("NORIZO_NODE_TOKEN_FILE", "/etc/norizo/node-token"))

SCHEMA_VERSION = 1

KNOWN_REPOS = (
    "norizo-dev-room",
    "oh-my-nihon-wine",
    "local-engine",
    "sayaka-kitchen",
)

KNOWN_UNITS = (
    "norizo-health.service",
    "norizo-control-agent.service",
    "omnw-discovery.service",
    "omnw-recognition.service",
    "omnw-master.service",
    "omnw-m0-m5.service",
)

# name -> (command, required by the Target DEV Stack in docs/CONOHA_DEV_BASELINE.md)
TOOLS: tuple[tuple[str, list[str], bool], ...] = (
    ("git", ["git", "--version"], True),
    ("gh", ["gh", "--version"], True),
    ("python3", ["python3", "--version"], True),
    ("node", ["node", "--version"], True),
    ("pnpm", ["pnpm", "--version"], True),
    ("docker", ["docker", "--version"], True),
    ("docker_compose", ["docker", "compose", "version"], True),
    ("tmux", ["tmux", "-V"], True),
    ("jq", ["jq", "--version"], True),
    ("rg", ["rg", "--version"], True),
    ("claude", ["claude", "--version"], True),
    ("codex", ["codex", "--version"], True),
    ("gemini", ["gemini", "--version"], False),
)


def run(cmd: list[str], timeout: float = 5.0) -> tuple[int, str]:
    try:
        proc = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return proc.returncode, proc.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return 127, ""


def first_line(text: str) -> str | None:
    for line in text.splitlines():
        if line.strip():
            return line.strip()
    return None


def read_os_release() -> dict[str, str]:
    result: dict[str, str] = {}
    try:
        for line in Path("/etc/os-release").read_text().splitlines():
            key, sep, raw = line.partition("=")
            if sep:
                result[key] = raw.strip().strip('"')
    except OSError:
        pass
    return result


def read_meminfo() -> dict[str, int]:
    result: dict[str, int] = {}
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            key, raw = line.split(":", 1)
            parts = raw.strip().split()
            if not parts:
                continue
            value = int(parts[0])
            if len(parts) > 1 and parts[1].lower() == "kb":
                value *= 1024
            result[key] = value
    except (OSError, ValueError):
        pass
    return result


def cpu_info() -> dict[str, Any]:
    model: str | None = None
    try:
        for line in Path("/proc/cpuinfo").read_text().splitlines():
            key, sep, raw = line.partition(":")
            if not sep:
                continue
            if key.strip() in ("model name", "Model"):
                model = raw.strip()
                break
    except OSError:
        pass
    return {"model": model, "logical_cores": os.cpu_count()}


def disk_status(path: Path) -> dict[str, int] | None:
    try:
        usage = shutil.disk_usage(path)
        return {"total": usage.total, "used": usage.used, "free": usage.free}
    except OSError:
        return None


def tool_versions() -> tuple[dict[str, Any], list[str]]:
    versions: dict[str, Any] = {}
    gaps: list[str] = []
    for name, cmd, required in TOOLS:
        path = shutil.which(cmd[0])
        entry: dict[str, Any] = {"present": False, "version": None, "path": path, "required": required}
        if path is not None:
            code, output = run(cmd)
            version = first_line(output)
            # `docker compose` is a plugin: the binary can exist while the subcommand does not.
            if code == 0 and version:
                entry["present"] = True
                entry["version"] = version
        if required and not entry["present"]:
            gaps.append(name)
        versions[name] = entry
    return versions, gaps


def unit_status() -> dict[str, str]:
    if shutil.which("systemctl") is None:
        return {}
    result: dict[str, str] = {}
    for unit in KNOWN_UNITS:
        _, output = run(["systemctl", "is-active", unit], 2.0)
        result[unit] = output or "unknown"
    return result


def repo_status() -> list[dict[str, Any]]:
    repos: list[dict[str, Any]] = []
    for name in KNOWN_REPOS:
        path = ROOT / name
        item: dict[str, Any] = {"name": name, "present": (path / ".git").is_dir()}
        if item["present"]:
            code, branch = run(["git", "-C", str(path), "symbolic-ref", "--quiet", "--short", "HEAD"])
            item["branch"] = branch if code == 0 and branch else None
            code, head = run(["git", "-C", str(path), "rev-parse", "HEAD"])
            item["head"] = head if code == 0 else None
            code, changes = run(["git", "-C", str(path), "status", "--porcelain"])
            item["dirty"] = bool(changes) if code == 0 else None
        repos.append(item)
    return repos


def health_endpoint() -> dict[str, Any]:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=3) as response:
            payload = json.loads(response.read().decode())
        return {"reachable": True, "ok": bool(payload.get("ok"))}
    except Exception as exc:  # noqa: BLE001 - any failure means "not reachable"
        return {"reachable": False, "error": type(exc).__name__}


def docker_status() -> dict[str, Any]:
    if shutil.which("docker") is None:
        return {"available": False}
    code, output = run(["docker", "ps", "--format", "{{.Names}}\t{{.Status}}"], 8.0)
    if code != 0:
        return {"available": True, "reachable": False}
    containers = []
    for line in output.splitlines():
        if not line.strip():
            continue
        name, _, status = line.partition("\t")
        containers.append({"name": name, "status": status})
    return {"available": True, "reachable": True, "containers": containers}


def build_baseline() -> dict[str, Any]:
    os_release = read_os_release()
    mem = read_meminfo()
    versions, gaps = tool_versions()
    units = unit_status()

    return {
        "schema_version": SCHEMA_VERSION,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "captured_by": "scripts/write-baseline.py",
        "node_id": NODE_ID,
        "host": {
            "hostname": socket.gethostname(),
            "os": {
                "pretty_name": os_release.get("PRETTY_NAME"),
                "id": os_release.get("ID"),
                "version_id": os_release.get("VERSION_ID"),
            },
            "kernel": platform.release(),
            "architecture": platform.machine(),
        },
        "cpu": cpu_info(),
        "memory": {"total": mem.get("MemTotal"), "available": mem.get("MemAvailable")},
        "disk": {"root": disk_status(Path("/")), "norizo": disk_status(ROOT) if ROOT.exists() else None},
        "versions": versions,
        "stack_gaps": gaps,
        "units": units,
        "health": {
            "unit": units.get("norizo-health.service"),
            "endpoint": health_endpoint(),
        },
        "control_agent": {
            "unit": units.get("norizo-control-agent.service"),
            # Presence only. The token value is never read or recorded.
            "token_file_present": NODE_TOKEN_FILE.exists(),
        },
        "docker": docker_status(),
        "repos": repo_status(),
    }


def write_baseline(payload: dict[str, Any]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = BASELINE_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    os.replace(tmp, BASELINE_FILE)


def main() -> int:
    payload = build_baseline()
    try:
        write_baseline(payload)
    except OSError as exc:
        print(f"baseline: could not write {BASELINE_FILE}: {exc}", file=sys.stderr)
        return 1

    print(f"baseline: wrote {BASELINE_FILE}")
    gaps = payload["stack_gaps"]
    if gaps:
        print("baseline: missing from the target DEV stack: " + ", ".join(gaps))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
