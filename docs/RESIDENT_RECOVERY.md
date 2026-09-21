# DEV ROOM resident execution and self-recovery

Introduced by the 2026-09-21 executor stop. Read
`INCIDENT_2026-09-21_EXECUTOR_STOP.md` first for why this exists.

## Principle

ChatGPT Automation must not be the execution body of DEV ROOM. When it stops,
DEV ROOM must keep running and must repair itself.

```text
ConoHa VPS  (execution authority, systemd)
├─ norizo-health.service          resident   Restart=always
├─ norizo-control-agent.service   resident   Restart=always
├─ norizo-p1-p5.timer  → .service schedule   P1-P5 execution
└─ norizo-supervisor.timer → .service        watchdog + recovery + audit log

ChatGPT Automation  (external, optional)
├─ hourly audit
├─ status reporting
└─ exceptional intervention
```

systemd is the outer supervisor. The watchdog is a timer, so it cannot be taken
down by the same event that takes down the thing it watches — which is exactly
what happened on 2026-09-21, when the watchdog was disabled ten seconds before
the executors it was supposed to protect.

## What is in this repository

| Path | Role |
| --- | --- |
| `deploy/supervisor/recovery_supervisor.py` | One-shot recovery pass |
| `deploy/supervisor/desired-state.json` | Declarative list of units to keep alive |
| `deploy/supervisor/norizo-supervisor.service` / `.timer` | Runs the pass every 5 minutes |
| `deploy/supervisor/install-supervisor.sh` | Installer (dry-runs before arming) |
| `scripts/run-p1-p5-executor.sh` | Locks, runs and records `scripts/execute-p1-p5.sh` |
| `deploy/executor/norizo-p1-p5.service` / `.timer` | Hourly resident P1-P5 schedule |
| `deploy/executor/install-p1-p5-timer.sh` | Installer, explicit opt-in |

## Supervisor safety contract

The supervisor is deliberately one-directional:

- It only runs `systemctl enable`, `start` and `restart`.
- It **never** stops, disables, masks or unmasks anything.
- A **masked** unit is reported, never touched — unmasking is a human decision.
- `ExecMainStatus=75` means HOLD / human review. The supervisor reports it and
  does not restart, matching the project-wide exit-75 convention.
- After 3 failed recovery attempts in an hour a unit is **held for 6 hours** and
  flagged for a human, instead of restart-storming.
- Units marked `required: false` that are not installed yet are ignored, so this
  ships safely ahead of the units it describes.
- Every decision and every corrective action is appended to an audit log.

## Detection: the gap that let 2026-09-21 go unnoticed

A stopped external executor left no local trace. The supervisor now also checks
heartbeat freshness and records staleness without trying to repair it:

| Heartbeat | Meaning if stale |
| --- | --- |
| `/opt/norizo/system/health/status.json` (15 min) | health service stopped refreshing |
| `/opt/norizo/system/phases/P1.json` (24 h) | P1-P5 executor stopped producing phase state |
| `/opt/norizo/system/phases/executor-run.json` (24 h) | the executor schedule itself stopped firing |

## Audit trail

| File | Contents |
| --- | --- |
| `/var/log/norizo/supervisor.jsonl` | Append-only JSONL: every repair, hold and stale heartbeat |
| `/var/log/norizo/executor.jsonl` | Append-only JSONL: every P1-P5 run, exit code and outcome |
| `/opt/norizo/system/supervisor-status.json` | Latest pass: per-unit state and `needs_human` list |
| `/opt/norizo/system/phases/executor-run.json` | Latest P1-P5 run record |
| `/opt/norizo/system/supervisor-state.json` | Throttle budget (internal) |

`needs_human` in `supervisor-status.json` is the single field to watch. If it is
empty, the node repaired itself.

## Install on the existing ConoHa VPS

Nothing here rebuilds the VPS, opens a port, touches Production, or modifies an
existing service. Both installers are additive and idempotent.

```bash
cd /opt/norizo/norizo-dev-room
git fetch origin
git switch <branch carrying this document>

# 1. See what the supervisor would repair, changing nothing.
sudo NORIZO_DESIRED_STATE=deploy/supervisor/desired-state.json \
  python3 deploy/supervisor/recovery_supervisor.py --dry-run

# 2. Arm the watchdog. Installs /etc/norizo/desired-state.json on first run and
#    never overwrites it afterwards.
sudo bash deploy/supervisor/install-supervisor.sh
```

Arming the P1-P5 schedule is a separate, explicit decision, because it makes the
VPS run the executor as root every hour on its own:

```bash
# Requires scripts/execute-p1-p5.sh to be present (PR #9), otherwise exits 75.
sudo NORIZO_ENABLE_P1_P5_TIMER=1 bash deploy/executor/install-p1-p5-timer.sh

# Optional single pass, on demand:
sudo systemctl start norizo-p1-p5.service
```

`ENABLE_STEEL=0` and `EXECUTE_BUILDS=0` remain the defaults in the unit, so
Steel self-host stays deferred and no deterministic build runs unattended.

## Verify

```bash
systemctl list-timers norizo-supervisor.timer norizo-p1-p5.timer
jq . /opt/norizo/system/supervisor-status.json
tail -n 20 /var/log/norizo/supervisor.jsonl
```

Recovery proof — stop a managed unit and confirm it comes back within 5 minutes:

```bash
sudo systemctl stop norizo-health.service
sleep 330
systemctl is-active norizo-health.service          # expect: active
grep unit_start /var/log/norizo/supervisor.jsonl | tail -n 1
```

## Changing what is managed

Edit `/etc/norizo/desired-state.json` on the VPS. `install-supervisor.sh` never
overwrites it. Fields per unit:

| Field | Meaning |
| --- | --- |
| `name` | systemd unit name |
| `mode` | `daemon` / `timer` — must be active. `oneshot` — enablement only |
| `required` | `true`: report a missing unit as needing a human. `false`: ignore until installed |

`norizo-claude-orchestrator.service` is deliberately **not** managed:
`P0_P5_RUNBOOK.md` forbids activating it during P0.

## Still open

- **SPOF-5** — `stop_unit norizo-health.service` still propagates a stop to every
  OMNW worker through `Requires=`. Needs a decision, see the incident document.
- **SPOF-6** — the control plane and the P1-P5 executor are still on unmerged
  branches, so `main` converges to neither.
