# INCIDENT — 2026-09-21 DEV ROOM executor stop

Status: **ROOT CAUSE: NOT PROVEN**
Audit scope completed: GitHub (`NORIZO0201/norizo-dev-room`, all 9 branches)
Audit scope **not** completed: ConoHa VPS host, Supabase control plane, ChatGPT Automation actor log

## 1. What happened

Three ChatGPT Automation tasks moved to `is_enabled=false` inside a ten-second
window on 2026-09-21:

| JST | Task |
| --- | --- |
| 16:57:43 | `OMNW Consumer Watchdog` |
| 16:57:50 | `OMNW Consumer M2 Executor` |
| 16:57:53 | `DEV ROOM P1-P5 Executor` |

The ConoHa VPS stayed ACTIVE. This was a state change, not a runtime failure.
The last `DEV ROOM P1-P5 Executor` run was 16:45:17 JST.

## 2. Evidence timeline

All repository evidence below is git commit/push time converted to JST.

| JST | Evidence | Source |
| --- | --- | --- |
| 16:11 | `docs: document Mac-local vs cloud session for ConoHa access` | `9f2053a` |
| 16:21 | `ops: establish ChatGPT-Claude shared handoff` | `094c782`, `d4a39e7` |
| 16:26 | `ops: define autonomous Mac-local ignition path` | `cf374ed`, `8493edd` |
| 16:28 | `arch: make ConoHa VPS the autonomous 24/7 executor` | `1330652` |
| 16:29 | `feat: add autonomous VPS Claude orchestrator` | `1d94bcc`…`89d4da2` |
| 16:40–16:44 | P0 convergence: health persistence, branch-safe bootstrap, snapshot-gated convergence | `4dbc54b`…`64e20dd` |
| **16:45:17** | **last `DEV ROOM P1-P5 Executor` run** | external report |
| **16:55:11** | `ops: record live P0 completion evidence` — `docs/AI_HANDOFF.md` gains "P0 is COMPLETE" | `8bfae28` |
| **16:57:43–16:57:53** | **the three tasks are disabled** | external report |
| **17:00:04–17:00:23** | `ops: add safe P1-P5 executor` + execution contract + CI, on a new branch `executor/p1-p5-20260921` | `2aec9cd`, `deb5dd5`, `0d210a4` |
| 17:00:30 | PR #9 `ops: DEV ROOM P1-P5 executor` opened | GitHub |

The disable sweep sits **2 minutes 32 seconds after** the repository declared
P0 complete and **2 minutes 11 seconds before** a replacement P1-P5 executor
was pushed.

## 3. Established facts

**F1 — No disable logic exists in this repository.**
A full-text scan of all 9 branches for `disable`, `is_enabled`, `pause`,
`retire`, `completed`, `cleanup`, `dedupe`, `automation`, `executor`,
`watchdog`, `P0`, `P1`, `P5`, `systemctl stop|disable|mask`, `kill`, `pkill`
returns no code that stops, disables, retires, deduplicates or cleans up any
automation, executor, watchdog or scheduled task. Every hit is documentation
prose, HTML button state, or the word "deduplication" in the OMNW data model.

**F2 — This repository cannot reach the ChatGPT Automation API.**
No client, endpoint, token reference or credential for that platform exists in
any branch. Nothing here is capable of setting `is_enabled=false` on an
Automation task.

**F3 — The stop was a sweep, not three independent failures.**
Three tasks, ten seconds, watchdog first. Independent runtime failures do not
order themselves that way.

**F4 — The sweep is bracketed by a P0→P1 migration.**
P0 declared complete at 16:55:11; replacement executor pushed at 17:00:04.

**F5 — The P1-P5 executor had no local schedule.**
`scripts/execute-p1-p5.sh` (PR #9) is a one-shot script. No systemd service,
no timer, no cron entry for it exists anywhere in the repository. Its only
trigger was the external Automation task.

**F6 — No watchdog or recovery supervisor existed in the repository.**
The only watchdog was `OMNW Consumer Watchdog`, hosted on the same platform as
the executors it watched — and disabled ten seconds before them.

**F7 — One remote command can stop every resident worker.**
`deploy/control-plane/telemetry_agent.py` allowlists `stop_unit` for
`norizo-health.service`. `deploy/workers/omnw-worker@.service.template`
declares `Requires=norizo-health.service`, and systemd propagates a stop across
`Requires=`. A single allowlisted `stop_unit norizo-health.service` therefore
stops all OMNW worker instances at once.

**F8 — `main` converges to nothing.**
The resident control plane lives only on unmerged `dev-room-p0-p5`; the P1-P5
executor lives only on unmerged `executor/p1-p5-20260921`. A host converged
from `main` today gets neither.

## 4. Root cause classification

| Candidate | Verdict | Basis |
| --- | --- | --- |
| **A** — automation/task cleanup over-reached into P1-P5 | **Ruled out for this repository** | F1, F2 |
| **B** — dedupe logic marked an active executor duplicate | **Ruled out for this repository** | F1, F2 |
| **C** — phase-completion processing terminated all executors | **Ruled out for this repository** | F1, F2 |
| **D** — explicit disable by a human or an AI during the P0→P1 migration | **Leading hypothesis, not proven** | F3, F4 — correlation and ordering only; no actor record obtained |
| **E** — platform-side state change with unknown actor | **Cannot be excluded** | no actor field is available to this audit |
| **F** — other | Not indicated | — |

**Verdict: ROOT CAUSE: NOT PROVEN.** The cause is D or E. The correlation in F4
is strong but correlation is not attribution, and this audit obtained no actor
record. Recording D as fact would be a guess.

**Evidence that would close this:** the ChatGPT Automation platform's own
audit/actor log for the three tasks at 16:57:43–16:57:53 JST. Nothing inside
GitHub, the VPS or Supabase can supply it.

## 5. Audit gaps

These remain open and are **not** answered by this document:

- **ConoHa VPS host inspection.** The `conoha-vps-mcp` server in `.mcp.json` is
  unauthenticated in this session, so systemd units, timers, journal, cron and
  `/opt/norizo` state around 16:30–17:10 JST were not read. The VPS being
  ACTIVE does not prove its internal services stayed up.
- **Supabase control-plane inspection.** `dev_room_commands`,
  `dev_room_node_status` and `dev_room_node_tokens` were not read, so it is
  unknown whether any `stop_unit` command was issued in that window (see F7).
- **Automation platform actor log.** Not accessible from here.

## 6. The actual design problem

The incident is not "three tasks were switched off". It is that switching them
off was **sufficient to stop DEV ROOM**, and that nothing noticed or recovered.

| ID | Single point of failure | Status |
| --- | --- | --- |
| SPOF-1 | P1-P5 execution was scheduled only by an external Automation task | **Fixed** — `norizo-p1-p5.timer` |
| SPOF-2 | The watchdog ran in the same failure domain as what it watched, and died first | **Fixed** — systemd is the outer supervisor |
| SPOF-3 | A stopped executor produced no local signal at all | **Fixed** — freshness checks + audit log |
| SPOF-4 | Nothing re-enabled or restarted a stopped resident unit | **Fixed** — `norizo-supervisor.timer` |
| SPOF-5 | `stop_unit norizo-health.service` stops every worker via `Requires=` (F7) | **Open — needs NORIZO's decision** |
| SPOF-6 | Control plane and executor exist only on unmerged branches (F8) | **Open — needs NORIZO's decision** |

See `RESIDENT_RECOVERY.md` for what was built and how to arm it.

## 7. Open decisions for NORIZO

1. **SPOF-5.** Change `omnw-worker@.service.template` from
   `Requires=norizo-health.service` to `Wants=` + `After=`? That keeps the
   "health starts before workers" ordering but removes stop-propagation, so one
   remote command can no longer take down every lane. The trade-off: workers
   would then keep running if health is deliberately stopped. Alternatively, or
   additionally, remove `norizo-health.service` from the control agent's
   `stop_unit` allowlist entirely. Not changed here — it alters running
   semantics of an existing contract.
2. **SPOF-6.** Merge `dev-room-p0-p5` (control plane) and PR #9 (P1-P5
   executor) into `main`, so a host converged from `main` is actually
   recoverable. Not merged here.
3. **Re-enabling the three ChatGPT Automation tasks.** Recommended only *after*
   the resident timers are armed, and then only in the reduced role described in
   `RESIDENT_RECOVERY.md` (audit and reporting, not execution). Re-enabling them
   as the execution path would restore the same single point of failure.
