# STATUS — NORIZO DEV ROOM

Updated: 2026-09-21 JST

## Current operating model

NORIZO LAB is **Chatty-first**.

- NORIZO → ChatGPT / Chatty is the only normal command origin.
- GitHub is code/document/history/checkpoint/audit storage only.
- GitHub Issues, PR comments, mentions, labels, and Actions are not an AI-dispatch mechanism.
- Claude Code, Codex, and Gemini are optional bounded tools, not standing execution owners.
- ConoHa is retired and is not part of the operating architecture.
- No autonomous AI-to-AI relay is part of the production operating model.

## P1–P5 execution order

1. **P1 — Control Room / health / canonical state**
2. **P2 — OMNW Discovery/Master + Consumer development support**
3. **P3 — reusable PC/SP browser QA gate**
4. **P4 — reusable worker/observation contracts for RELIS and similar projects**
5. **P5 — deterministic project batch/QA gates + handoff state**

Canonical machine-readable state: `state/DEV_ROOM_STATE.json`.
Completion evidence: `docs/evidence/`.

## Infrastructure direction

### GitHub
Keep repositories, code, documents, diffs, phase state and audit history.
Do not use GitHub as an AI command bus.

### Supabase
Use project databases/backends through explicit schemas and deterministic service boundaries. OMNW Discovery/Master data remains separate from Consumer-facing development state.

### Browser QA
Use managed browser/provider APIs or already-available browser tooling. No VPS is required for PC/SP responsive checks, navigation, runtime/console inspection, screenshots, or regression evidence.

### Vercel
Local/tooling QA → Preview only when NORIZO asks → NORIZO confirmation → Production.

## Retired on 2026-09-21

- ConoHa / VPS dependency for DEV ROOM
- ConoHa MCP configuration
- ConoHa provisioning/setup path
- GitHub → Claude Code dispatch
- GitHub → Codex dispatch
- GitHub → Gemini dispatch
- Claude resident orchestrator
- GitHub Actions as AI handoff infrastructure
- AI TEAM v1 / three-agent coordination model
- autonomous AI-to-AI P0→P5 rollout model

Historical git history remains the audit record. These mechanisms must not be restored without a new explicit NORIZO decision.
