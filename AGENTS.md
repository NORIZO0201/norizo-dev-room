# AGENTS.md — NORIZO LAB Repository Rules

## Command origin
NORIZO → ChatGPT / Chatty is the normal command path.

This repository is not an autonomous agent coordination system.

## GitHub role
GitHub stores:
- code
- documentation
- diffs
- release/history evidence
- phase/checkpoint state
- audit trail

Do not use Issues, PR comments, mentions, labels, or GitHub Actions to dispatch work to Claude Code, Codex, Gemini, or any other AI.

## External AI tools
Claude Code, Codex, and Gemini may be used only for bounded, explicitly requested work.
They are not standing owners and must not create self-sustaining handoff loops.

## Retired infrastructure
ConoHa/VPS is permanently retired from DEV ROOM.

- Do not inspect, start, rebuild, recreate, or depend on ConoHa.
- Do not add VPS dependencies to DEV ROOM.
- Do not keep executable tombstones, systemd units, installers, or resident-worker launchers for retired infrastructure in the live tree.
- Git history is the audit record for removed infrastructure.

## DEV ROOM lifecycle
P1–P5 are complete. DEV ROOM is a reusable development foundation, not a standing hourly workload.

- No DEV ROOM Watchdog or P1–P5 Executor should be scheduled.
- Maintenance is on-demand: run deterministic validators when DEV ROOM state or contracts change, or when a project explicitly uses the foundation.
- Project-specific ongoing workers (for example OMNW Discovery or RELIS) remain separate from DEV ROOM lifecycle automation.

## Browser QA
Use managed browser/provider APIs or other already-available browser tooling for PC/SP QA.
The reusable QA path must cover responsive layouts, navigation, console/runtime errors, screenshots/evidence, and regression verification without requiring a VPS.

## Phase state
`state/DEV_ROOM_STATE.json` is the canonical P1–P5 checkpoint.
Every phase completion must include exact evidence paths/identifiers so the next run can resume idempotently.

## Deployment safety
Vercel flow:
Local/tooling QA → Preview only when NORIZO asks → NORIZO confirmation → Production.

Explicit NORIZO approval is required for:
- Production deployment
- Vercel Preview creation when NORIZO has not asked to see it
- destructive data deletion
- DNS changes
- secret/key rotation
- new paid services or material paid API usage

Never commit secrets, tokens, passwords, or private keys.
