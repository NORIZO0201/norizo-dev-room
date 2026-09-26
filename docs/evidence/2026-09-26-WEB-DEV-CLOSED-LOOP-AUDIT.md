# web-dev closed loop audit — DEV ROOM (2026-09-26)

web-dev-order: web-dev-closed-loop-audit-20260926
Order: NORIZO0201/norizo-lab-orchestrator#8 (full evidence: orchestrator `docs/evidence/web-dev-audit-20260926.md`)
Repair: Issue #34 repairs PR #33 (NG round 1, reviewed-sha `2f00f16fe99ed70fb415113b0bea8bd324fb7d6b`) — updates this same document and `AGENTS.md` in place, same PR branch (`claude/web-dev-closed-loop-audit-ucm1io`).

## Actual State (DEV ROOM)
- Forward: Issue #30 (`dev-order`) -> routine "DEV ROOM Developer" (origin `github_webhook_trigger`, +3s) -> PR #31. Verified.
- Return: PR #32 opened -> ChatGPT Work QA PASS (768bdc9b); synchronize -> Work QA PASS (80e65dd7). Verified.
- Gap: PR #31 (Claude PR) never received Work QA (Work task created later).
- NG -> repair Issue -> same-PR update: this repair (Issue #34 -> PR #33 synchronize) is the first exercise of that path.
- Not yet exercised: PASS -> production.

## Change in this repo
`AGENTS.md` gains the "web-dev lane" section: `web-dev` is canonical, `dev-order` is the compat trigger label, repair Issues (`repairs-pr:` / `head-branch:`) update the existing PR instead of opening a new one, no self re-dispatch, QA verdicts belong to ChatGPT Work.

Why AGENTS.md: the live routine prompt cannot be edited by an agent (routine created via the claude.ai UI/API), and it still says "always create a new PR". Every routine run reads AGENTS.md (prompt rule 1), so the repair rule lives in the repo. The routine clones the default branch, so this rule takes effect only after this PR is merged to `main` (`main` Vercel deployment is disabled in `vercel.json`, so merging does not deploy Production).

## Repair (Issue #34, NG round 1) — Desired vs. Actual State

The original PR #33 text asserted two things ahead of evidence. This repair corrects the wording; it does not change the closed-loop design.

| Claim | Desired State (original PR #33 wording) | Actual State (verified 2026-09-26) | Fix in this repair |
| --- | --- | --- | --- |
| `config/web_dev.yaml` | Cited as part of the merged canonical contract, same as `docs/WEB_DEV_UNIVERSAL_CLOSED_LOOP_V1.md` | Exists only in orchestrator PR #9; 404s on orchestrator `main` (unresolved cross-repo dependency) | `AGENTS.md` drops it from the "already canonical" list and adds a PENDING paragraph naming orchestrator PR #9; only `docs/WEB_DEV_UNIVERSAL_CLOSED_LOOP_V1.md` is treated as merged canon for now |
| `web-dev` label | "web-dev Issues here carry both labels" (`web-dev` + `dev-order`) | `GET /repos/NORIZO0201/norizo-dev-room/labels/web-dev` → 404 (checked via `mcp__github__get_label`, 2026-09-26); no Issue in this repo carries `web-dev`; issue search finds none | `AGENTS.md` now states `web-dev` has not been created as a repository label here and `dev-order` is the only proven live trigger label. **Not created in this repair**: the GitHub MCP toolset available to this routine has no label-create capability (`create_label` is not among the loaded `mcp__github__*` tools), so the label was verified absent, not created. Creating it is a small one-time GitHub Settings → Labels action for NORIZO/Chatty, or a future routine run with a label-create tool. |

**Unresolved cross-repo dependency**: `config/web_dev.yaml` becoming canonical here is gated on orchestrator PR #9 merging to orchestrator `main`. This repo cannot merge that PR (out of scope/repo). Tracking: once orchestrator PR #9 merges, update the PENDING paragraph in `AGENTS.md` (a follow-up Issue, not automatic).

**Regression check**: `npm run qa:web-dev-lane` (`scripts/validate-web-dev-lane-refs.mjs`) is a new, repo-local, deterministic check that fails if `AGENTS.md` ever again (a) claims `web-dev` Issues already carry the `web-dev` label, (b) drops the "not yet created" statement about the `web-dev` label, or (c) references `config/web_dev.yaml` without the PENDING / orchestrator-PR-#9 qualifier. It cannot itself confirm the *current* live state of the orchestrator file or this repo's labels (that requires network/API access this validator deliberately does not take, to stay deterministic and zero-cost) — so the correct enforcement point for "is `config/web_dev.yaml` actually on orchestrator `main` yet" is a contract test in `NORIZO0201/norizo-lab-orchestrator` itself (the repo that owns that file and can assert its own `main` state); this repo's check only guards the wording here from drifting back to an unqualified claim.
