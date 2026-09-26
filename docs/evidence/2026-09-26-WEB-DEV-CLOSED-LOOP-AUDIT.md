# web-dev closed loop audit — DEV ROOM (2026-09-26)

web-dev-order: web-dev-closed-loop-audit-20260926
Order: NORIZO0201/norizo-lab-orchestrator#8 (full evidence: orchestrator `docs/evidence/web-dev-audit-20260926.md`)

## Actual State (DEV ROOM)
- Forward: Issue #30 (`dev-order`) -> routine "DEV ROOM Developer" (origin `github_webhook_trigger`, +3s) -> PR #31. Verified.
- Return: PR #32 opened -> ChatGPT Work QA PASS (768bdc9b); synchronize -> Work QA PASS (80e65dd7). Verified.
- Gap: PR #31 (Claude PR) never received Work QA (Work task created later).
- Not yet exercised: NG -> repair Issue -> same-PR update -> re-QA; PASS -> production.

## Change in this repo
`AGENTS.md` gains the "web-dev lane" section: `web-dev` is canonical, `dev-order` is the compat trigger label, repair Issues (`repairs-pr:` / `head-branch:`) update the existing PR instead of opening a new one, no self re-dispatch, QA verdicts belong to ChatGPT Work.

Why AGENTS.md: the live routine prompt cannot be edited by an agent (routine created via the claude.ai UI/API), and it still says "always create a new PR". Every routine run reads AGENTS.md (prompt rule 1), so the repair rule lives in the repo. The routine clones the default branch, so this rule takes effect only after this PR is merged to `main` (`main` Vercel deployment is disabled in `vercel.json`, so merging does not deploy Production).
