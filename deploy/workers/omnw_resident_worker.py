#!/usr/bin/env python3
"""Low-concurrency OMNW resident worker for DEV ROOM P2.

The worker deliberately does not contain discovery/collector business logic.  It
executes one deterministic, server-side checkpointed step at a time through the
OMNW ``omnw-resident-step`` Edge Function and authenticates with the existing
ConoHa DEV ROOM node token.  Discovery and Master run as separate systemd
services; Consumer M0-M4 is intentionally not part of this process.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(os.environ.get("NORIZO_ROOT", "/opt/norizo"))
TOKEN_FILE = Path(os.environ.get("NORIZO_NODE_TOKEN_FILE", "/etc/norizo/node-token"))
ENDPOINT = os.environ.get(
    "OMNW_RESIDENT_ENDPOINT",
    "https://alqnnnkuvdpxkqxdqted.supabase.co/functions/v1/omnw-resident-step",
)
NODE_ID = os.environ.get("NORIZO_NODE_ID", "conoha-01")
STATE_DIR = ROOT / "system" / "workers"
HOLD_EXIT = 75


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def read_token() -> str:
    try:
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    except OSError as exc:
        raise RuntimeError(f"node token unavailable: {exc}") from exc
    if not token:
        raise RuntimeError("node token empty")
    return token


def invoke(lane: str, token: str, timeout: float) -> tuple[int, dict[str, Any]]:
    body = json.dumps({"node_id": NODE_ID, "lane": lane}).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "authorization": "Bearer " + token,
            "content-type": "application/json",
            "user-agent": "norizo-omnw-resident/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8", errors="replace")
            data = json.loads(raw or "{}")
            return int(response.status), data if isinstance(data, dict) else {"value": data}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw or "{}")
        except json.JSONDecodeError:
            data = {"error": raw[-1000:]}
        return int(exc.code), data if isinstance(data, dict) else {"value": data}


def sleep_with_jitter(seconds: int) -> None:
    # Small jitter keeps multiple resident lanes from synchronizing their HTTP calls.
    jitter = min(10.0, max(0.0, seconds * 0.05))
    time.sleep(max(1.0, seconds + random.uniform(-jitter, jitter)))


def main() -> int:
    parser = argparse.ArgumentParser(description="OMNW resident Discovery/Master worker")
    parser.add_argument("lane", choices=("discovery", "master"))
    args = parser.parse_args()

    lane = args.lane
    interval_default = 600 if lane == "discovery" else 900
    interval = max(60, int(os.environ.get("OMNW_WORKER_INTERVAL_SECONDS", str(interval_default))))
    timeout = max(15.0, float(os.environ.get("OMNW_WORKER_HTTP_TIMEOUT_SECONDS", "150")))
    max_backoff = max(interval, int(os.environ.get("OMNW_WORKER_MAX_BACKOFF_SECONDS", "3600")))
    state_file = STATE_DIR / f"omnw-{lane}.json"

    try:
        token = read_token()
    except RuntimeError as exc:
        write_json_atomic(
            state_file,
            {
                "lane": lane,
                "node_id": NODE_ID,
                "status": "hold",
                "last_seen_at": utc_now(),
                "last_error": str(exc),
                "exit_code": HOLD_EXIT,
            },
        )
        return HOLD_EXIT

    failures = 0
    while True:
        started = utc_now()
        try:
            http_status, response = invoke(lane, token, timeout)
            remote_status = str(response.get("status", "unknown"))

            if http_status in (401, 403):
                write_json_atomic(
                    state_file,
                    {
                        "lane": lane,
                        "node_id": NODE_ID,
                        "status": "hold",
                        "last_seen_at": utc_now(),
                        "last_started_at": started,
                        "http_status": http_status,
                        "remote": response,
                        "last_error": "resident endpoint authentication rejected",
                        "exit_code": HOLD_EXIT,
                    },
                )
                return HOLD_EXIT

            successful = 200 <= http_status < 300 and remote_status in {
                "succeeded",
                "idle",
                "accepted",
            }
            if successful:
                failures = 0
                checkpoint = response.get("checkpoint") if isinstance(response.get("checkpoint"), dict) else {}
                write_json_atomic(
                    state_file,
                    {
                        "lane": lane,
                        "node_id": NODE_ID,
                        "status": "healthy",
                        "last_seen_at": utc_now(),
                        "last_success_at": utc_now(),
                        "last_started_at": started,
                        "http_status": http_status,
                        "remote_status": remote_status,
                        "checkpoint": checkpoint,
                        "consecutive_failures": 0,
                    },
                )
                sleep_with_jitter(interval)
                continue

            failures += 1
            backoff = min(max_backoff, interval * (2 ** min(failures - 1, 4)))
            write_json_atomic(
                state_file,
                {
                    "lane": lane,
                    "node_id": NODE_ID,
                    "status": "degraded",
                    "last_seen_at": utc_now(),
                    "last_started_at": started,
                    "http_status": http_status,
                    "remote_status": remote_status,
                    "remote": response,
                    "consecutive_failures": failures,
                    "retry_in_seconds": backoff,
                },
            )
            sleep_with_jitter(backoff)
        except (OSError, TimeoutError, urllib.error.URLError, json.JSONDecodeError) as exc:
            failures += 1
            backoff = min(max_backoff, interval * (2 ** min(failures - 1, 4)))
            write_json_atomic(
                state_file,
                {
                    "lane": lane,
                    "node_id": NODE_ID,
                    "status": "degraded",
                    "last_seen_at": utc_now(),
                    "last_started_at": started,
                    "last_error": str(exc),
                    "consecutive_failures": failures,
                    "retry_in_seconds": backoff,
                },
            )
            sleep_with_jitter(backoff)


if __name__ == "__main__":
    sys.exit(main())
