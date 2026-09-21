# STATUS — NORIZO DEV ROOM

Updated: 2026-09-22 JST

## Current status

**P1 complete / P2 complete / P3 complete / P4 complete / P5 complete.**

DEV ROOM is a completed reusable development foundation. Its post-P5 operating mode is **on-demand maintenance**.

Canonical machine-readable state: `state/DEV_ROOM_STATE.json`  
P5 handoff: `state/P5_HANDOFF.json`  
Maintenance checkpoint: `state/MAINTENANCE_OBSERVATION.json`  
Maintenance contract: `contracts/maintenance-mode.json`  
Completion evidence: `docs/evidence/`

## Current operating model

- NORIZO → ChatGPT / Chatty is the normal command origin.
- GitHub is code/document/history/checkpoint/audit storage only.
- Claude Code, Codex, and Gemini are optional bounded tools.
- ConoHa/VPS is retired and absent from the live runtime architecture.
- DEV ROOM P1–P5 Watchdog and Executor are retired; no hourly DEV ROOM lifecycle automation is required.
- OMNW Discovery, RELIS, CNW, SAYAKA and other project-specific ongoing operations remain separate and are not disabled by this DEV ROOM cleanup.

## P1–P5 foundation

1. **P1 — Control Room / health / canonical state — COMPLETE**
2. **P2 — OMNW Discovery/Master + Consumer development support — COMPLETE**
3. **P3 — reusable PC/SP browser QA gate — COMPLETE**
4. **P4 — reusable worker/observation contracts — COMPLETE**
5. **P5 — deterministic project batch/QA gates + handoff state — COMPLETE**

## On-demand maintenance

Run `npm run qa:maintenance` after foundation state/contract changes or before relying on the foundation for a new project handoff.

Maintenance preserves:
- P1–P5 completion state;
- OMNW Discovery/Master ↔ Consumer separation;
- retired OMNW Harvest absence;
- reusable PC/SP browser QA;
- reusable checkpoint/heartbeat contracts;
- Preview/Production approval boundaries.

It does **not** require an hourly DEV ROOM Watchdog or Executor.

## Live-tree cleanup rule

Do not accumulate retired launchers or tombstones in the active tree.

Removed legacy classes include:
- ConoHa provisioning/setup scripts;
- VPS/systemd health server and service files;
- VPS-bound OMNW resident worker/service templates;
- old DEV ROOM Watchdog/Executor incident machinery.

Git history is the audit record. Current documentation should describe only the active architecture plus concise retirement rules.

## Deployment policy

Local/tooling QA → Preview only when NORIZO asks → NORIZO confirmation → Production only with explicit NORIZO approval.

DEV ROOM automatic Git deployment remains disabled. No Preview or Production deployment is implied by foundation QA or maintenance.
