#!/usr/bin/env python3
"""Local-only health endpoint for the NORIZO AI WORK FACTORY.

No secrets are read or returned. The server binds to loopback only and also writes
an atomic JSON snapshot that other local services can consume.
"""

from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

HOST = os.environ.get("NORIZO_HEALTH_HOST", "127.0.0.1")
PORT = int(os.environ.get("NORIZO_HEALTH_PORT", "8787"))
ROOT = Path(os.environ.get("NORIZO_ROOT", "/opt/norizo"))
STATE_DIR = ROOT / "system" / "health"
STATE_FILE = STATE_DIR / "status.json"
REFRESH_SECONDS = max(15, int(os.environ.get("NORIZO_HEALTH_REFRESH_SECONDS", "60")))

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


def run(cmd: list[str], timeout: float = 2.0) -> tuple[int, str]:
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


def read_uptime() -> float | None:
    try:
        return float(Path("/proc/uptime").read_text().split()[0])
    except (OSError, ValueError, IndexError):
        return None


def disk_status(path: Path) -> dict[str, int] | None:
    try:
        usage = shutil.disk_usage(path)
        return {"total": usage.total, "used": usage.used, "free": usage.free}
    except OSError:
        return None


def docker_status() -> dict[str, Any]:
    if shutil.which("docker") is None:
        return {"available": False, "containers": []}
    code, output = run(["docker", "ps", "--format", "{{.Names}}\t{{.Status}}"], 3.0)
    if code != 0:
        return {"available": True, "reachable": False, "containers": []}
    containers = []
    for line in output.splitlines():
        if not line.strip():
            continue
        name, _, status = line.partition("\t")
        containers.append({"name": name, "status": status})
    return {"available": True, "reachable": True, "containers": containers}


def repo_status() -> list[dict[str, Any]]:
    repos = []
    for name in KNOWN_REPOS:
        path = ROOT / name
        item: dict[str, Any] = {"name": name, "present": (path / ".git").is_dir()}
        if item["present"]:
            code, head = run(["git", "-C", str(path), "rev-parse", "--short", "HEAD"])
            item["head"] = head if code == 0 else None
            code, changes = run(["git", "-C", str(path), "status", "--porcelain"])
            item["dirty"] = bool(changes) if code == 0 else None
        repos.append(item)
    return repos


def unit_status() -> dict[str, str]:
    if shutil.which("systemctl") is None:
        return {}
    result: dict[str, str] = {}
    for unit in KNOWN_UNITS:
        code, output = run(["systemctl", "is-active", unit], 1.5)
        result[unit] = output or ("unknown" if code == 0 else "inactive")
    return result


def build_status() -> dict[str, Any]:
    mem = read_meminfo()
    try:
        load = list(os.getloadavg())
    except OSError:
        load = []

    root_disk = disk_status(Path("/"))
    norizo_disk = disk_status(ROOT) if ROOT.exists() else None

    return {
        "ok": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "hostname": socket.gethostname(),
        "uptime_seconds": read_uptime(),
        "load_average": load,
        "memory": {
            "total": mem.get("MemTotal"),
            "available": mem.get("MemAvailable"),
        },
        "disk": {"root": root_disk, "norizo": norizo_disk},
        "docker": docker_status(),
        "repos": repo_status(),
        "units": unit_status(),
    }


def write_snapshot(payload: dict[str, Any]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    os.replace(tmp, STATE_FILE)


def refresh_loop() -> None:
    while True:
        try:
            write_snapshot(build_status())
        except OSError:
            pass
        time.sleep(REFRESH_SECONDS)


class Handler(BaseHTTPRequestHandler):
    server_version = "NorizoHealth/1.0"

    def do_GET(self) -> None:  # noqa: N802
        if self.path not in ("/health", "/status"):
            self.send_error(404)
            return
        payload = build_status()
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: object) -> None:
        return


def main() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    write_snapshot(build_status())
    thread = threading.Thread(target=refresh_loop, daemon=True)
    thread.start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
