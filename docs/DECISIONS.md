# DECISIONS — NORIZO DEV ROOM

Append-only decision log. Newer entries supersede older conflicting operating assumptions.

## 2026-09-21 — D001: Single Source of Truth

**Decision:** The latest merged GitHub `main` branch is the only canonical project truth.

Issues are work/intent. PRs are proposed changes. Chat is draft context.

## 2026-09-21 — D002: AI team roles

**Decision:**
- ChatGPT = PM / Architect / Dispatcher
- Claude Code = primary implementation owner
- Gemini = Research / Auditor / Reviewer
- NORIZO = final decision / merge gate

**Reason:** Prevent file ownership collisions and remove NORIZO from AI-to-AI message relay.

## 2026-09-21 — D003: No project-level state.json in v1

**Decision:** Do not introduce `state.json` as a second coordination truth in v1.

**Reason:** Current repository already suffered duplicated state across Issues, HANDOFF docs and operational ledgers. Machine runtime state can be introduced later where it belongs.

## 2026-09-21 — D004: GitHub first, ConoHa second

**Decision:** Establish the three-AI operating model on GitHub before extending it to ConoHa.

**Reason:** Separate collaboration design failures from VPS/runtime failures.

## 2026-09-21 — D005: AI_HANDOFF is historical, not active state

**Decision:** `docs/AI_HANDOFF.md` remains as historical P0 evidence until archived, but it is no longer the active coordination source.

Current state belongs in `docs/STATUS.md`; work belongs in Issues.


## 2026-09-21 — D006: NORIZO is not a routine approval bottleneck

**Decision:** Routine low-risk, reversible changes do not require NORIZO to press merge or relay instructions.

They may merge after required CI/checks and independent review. NORIZO remains the mandatory gate for high-risk, destructive, paid, security-sensitive, Production, DNS, secret/key, and major architecture-boundary changes.

**Reason:** Requiring NORIZO for every merge recreates the human bottleneck the AI-team design is meant to remove.
