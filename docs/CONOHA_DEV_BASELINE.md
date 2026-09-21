# ConoHa DEV Baseline — RETIRED TOMBSTONE

Retired: 2026-09-21 JST

ConoHa is no longer part of NORIZO DEV ROOM.

This file is retained only as an audit/tombstone marker so historical references resolve safely. It is **not** an operating guide.

## Mandatory rule

Do not:
- inspect ConoHa
- start or stop ConoHa resources
- recreate/rebuild a VPS
- migrate a DEV ROOM phase to a VPS
- restore the former resident-worker/control-plane setup
- use historical scripts in `deploy/` as a live deployment path

The canonical operating state is `state/DEV_ROOM_STATE.json` and the current architecture is `docs/DEV_ROOM_ARCHITECTURE.md`.

Browser QA uses managed/available browser provider tooling. Project checkpoints and deterministic gates are repository/service based and provider-neutral.
