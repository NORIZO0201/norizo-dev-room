# STATUS — NORIZO DEV ROOM

Updated: 2026-09-21 JST

## Current operating model

NORIZO LAB is **Chatty-first**.

- NORIZO → ChatGPT / Chatty is the only normal command origin.
- GitHub is code/document/history/audit storage only.
- GitHub Issues, PR comments, mentions, labels, and Actions are not an AI-dispatch mechanism.
- Claude Code, Codex, and Gemini are optional bounded tools, not standing execution owners.
- ConoHa is a normal resident-batch host managed from Chatty, one workload at a time.
- No autonomous AI-to-AI relay is part of the production operating model.

## Current infrastructure direction

### GitHub
Keep repositories, code, documents, diffs and audit history.
Do not use GitHub as an AI command bus.

### ConoHa
Use only for proven long-running deterministic workloads.
Each workload is migrated individually after one-shot verification and must have:
- explicit entrypoint
- checkpoint/idempotency strategy
- bounded retry behavior
- systemd/timer/cron definition only when required
- logs and health evidence
- stop/removal procedure

### Steel
Use self-hosted Steel Browser as the browser-development/QA base for PC/SP when needed.
Keep Steel private; do not expose browser-control ports publicly.

### Vercel
Local/ConoHa QA → Preview only when NORIZO asks → NORIZO confirmation → Production.

## Retired on 2026-09-21

- GitHub → Claude Code dispatch
- GitHub → Codex dispatch
- GitHub → Gemini dispatch
- Claude resident orchestrator
- GitHub Actions as AI handoff infrastructure
- AI TEAM v1 / three-agent coordination model
- autonomous P0→P5 AI rollout model

Historical git history remains the audit record. These mechanisms must not be restored without a new explicit NORIZO decision.
