#!/usr/bin/env python3
"""Retired tombstone for the former VPS baseline inspector.

ConoHa/VPS is no longer part of NORIZO DEV ROOM. This entrypoint must never
inspect host services, Docker, repositories, or systemd state. Canonical health
comes from DEV ROOM state plus allowlisted provider APIs.
"""

import sys


def main() -> int:
    print(
        "RETIRED: VPS baseline inspection is disabled; use DEV ROOM canonical state/provider APIs.",
        file=sys.stderr,
    )
    return 78


if __name__ == "__main__":
    raise SystemExit(main())
