> **Historical / deferred execution reference.**  
> P1–P5 rollout is currently paused while NORIZO AI TEAM v1 collaboration is validated.  
> Do not use this file as current work state; see `docs/STATUS.md` and GitHub Issues.

# DEV ROOM P1-P5 Executor

Updated: 2026-09-21 JST

This is the execution contract for the current ConoHa VPS. It preserves the existing host and follows the phased order already defined in `CONOHA_DEV_BASELINE.md`.

## Phase contract

| Phase | Execution target | Gate |
| --- | --- | --- |
| P1 | Install/verify `norizo-health.service` and loopback `127.0.0.1:8787/health` | Must be healthy before any resident worker |
| P2 | OMNW resident-worker foundation, Discovery first | Do not invent an entrypoint; audit the real deterministic launcher and checkpoint/write semantics |
| P3 | Steel Self-host | Deferred by default; enable only when a concrete browser-dependent workload exists |
| P4 | RELIS / LOCAL ENGINE observation workers | Reuse the P2 worker contract; low concurrency, structured sources first |
| P5 | SAYAKA / Cheese / CNW deterministic batches | Build/QA only after repo-specific deterministic commands are verified |

## Executor

Run on the existing VPS:

```bash
cd /opt/norizo/norizo-dev-room
git fetch origin
git switch executor/p1-p5-20260921
sudo bash scripts/execute-p1-p5.sh
```

Optional gates:

```bash
ENABLE_STEEL=1 sudo -E bash scripts/execute-p1-p5.sh
EXECUTE_BUILDS=1 sudo -E bash scripts/execute-p1-p5.sh
```

The executor writes atomic phase state files under `/opt/norizo/system/phases/P1.json` through `P5.json`.

## Non-negotiable safeguards

- No VPS rebuild/recreate.
- No destructive Git reset.
- No new public port.
- No credentials in GitHub.
- No Production deployment.
- No browser automation before API/RSS/sitemap/JSON-LD paths are exhausted.
- 403/CAPTCHA/suspicious blocking stops that lane.
- P2/P4 workers must be idempotent or checkpointed and use low concurrency.
- Vercel remains Local/ConoHa QA -> Preview only when NORIZO asks -> confirmation -> Production with explicit approval.

## Current known state

P1 implementation exists and is directly executable. P2 has the resident systemd template but the actual OMNW Discovery launcher is not yet proven in the repository; the executor therefore records P2 as staged/blocked rather than fabricating a command. P3 is intentionally deferred. P4 and P5 are staged only after their real repository entrypoints and write targets are audited.
