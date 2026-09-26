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

GitHub Actions, PR comments, and mentions must not be used to dispatch AI work.

Approved exception (NORIZO, 2026-09-26): a newly opened GitHub Issue carrying the `dev-order` label may dispatch one bounded Cloud Claude Code Routine for DEV ROOM development. This is the canonical Cloud Web Development lane. It is not a resident worker, polling loop, GMK task, or self-sustaining agent loop. Each issue is one explicit NORIZO/Chatty-originated order; the routine may implement, test, verify, open a PR, and report the result back to that issue. It must not autonomously create another `dev-order` or recursively dispatch itself.

### web-dev lane (canonical name since 2026-09-26)
The lane above is the DEV ROOM instance of the NORIZO LAB `web-dev` closed loop (canonical contract: `NORIZO0201/norizo-lab-orchestrator` `docs/WEB_DEV_UNIVERSAL_CLOSED_LOOP_V1.md`). `web-dev` is the canonical route name; `dev-order` is the compatibility label that the live routine trigger listens to, and as of this writing (2026-09-26, repair of #33 via #34) `dev-order` remains the only label proven to exist here and to be present on live dev-order Issues. `web-dev` has not been created as a repository label here, and no Issue in this repo carries it yet — do not claim it is already applied to web-dev Issues; treat that as Desired State until it is created and verified (see `docs/evidence/2026-09-26-WEB-DEV-CLOSED-LOOP-AUDIT.md`). `cloud-dev` is not wired to anything.

PENDING cross-repo dependency: `config/web_dev.yaml` (the machine-readable half of the canonical contract) exists only in orchestrator PR #9 as of 2026-09-26 and 404s on orchestrator `main`. Do not read or depend on `config/web_dev.yaml` from `main` until orchestrator PR #9 merges; `docs/WEB_DEV_UNIVERSAL_CLOSED_LOOP_V1.md` is the only half of the canonical contract safe to treat as merged right now. `npm run qa:web-dev-lane` fails if this paragraph is removed while the dependency is still unmerged, so update it (not just delete it) once orchestrator PR #9 merges.

Rules for the implementation routine in this repo (they apply whatever the routine prompt says about branches/PRs):
1. Development Issue (no `repairs-pr:` line): work on a `claude/` branch and open exactly one PR whose body contains `web-dev-order: <order_id>` and `Issue: #<n>`.
2. Repair Issue (contains `repairs-pr: #N` and `head-branch: <branch>`): do NOT open a new PR. Check out `<branch>`, fix, test, push to that same branch so PR #N is updated (this `synchronize` event re-triggers ChatGPT Work QA). Comment the result on PR #N and on the repair Issue, then close the repair Issue. If `<branch>` does not start with `claude/` or the push is rejected, comment `BLOCKED: cannot update PR #N (<reason>)` on the repair Issue and stop.
3. If PR #N is closed/merged, or the same `reviewed-sha` was already repaired, change nothing and say so on the Issue.
4. Never create `web-dev` / `dev-order` Issues and never declare QA PASS; QA verdicts belong to ChatGPT Work (`## ChatGPT Work QA — <VERDICT>` + `Reviewed commit <sha>`).

## External AI tools
Claude Code, Codex, and Gemini may be used only for bounded, explicitly requested work.
They are not standing owners and must not create self-sustaining handoff loops. The approved `dev-order` Cloud Claude Code Routine is bounded to the triggering issue and terminates after implementation/verification/PR/report.

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
GitHub development branch update → Preview → DEV ROOM → automated Visual QA → NORIZO confirmation → Production.

Explicit NORIZO approval is required for:
- Production deployment
- destructive data deletion
- DNS changes
- secret/key rotation
- new paid services or material paid API usage

Never commit secrets, tokens, passwords, or private keys.
