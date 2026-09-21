# SPEC — NORIZO AI TEAM v1

## Architecture

```text
NORIZO
  |
  v
ChatGPT (PM / Architect)
  |
  v
GitHub Issues -------- main
  |                    ^
  v                    |
Claude Code -> PR -> Gemini Review
                    |
                    v
      auto-merge if low-risk + checks PASS
                    |
          NORIZO only if high-risk
```

## Canonicality

- Only merged `main` is canonical.
- Issues contain unaccepted intent/work state.
- PRs contain candidate changes.
- Runtime state may live in Supabase only when required by a running service.

## v1 boundaries

Included now:
- shared agent constitution
- agent-specific rules
- project/spec/decision/status separation
- Issue-based task coordination
- PR-based change review
- GitHub-visible handoff between agents with no NORIZO copy/paste relay

Explicitly deferred:
- `state.json` as project coordination truth
- GitHub Actions agent ping-pong
- automatic agent invocation beyond the pilot until the trigger path is verified
- new Supabase coordination schema
- ConoHa resident AI-team orchestration
- new AI-HQ repository

## Ownership model

- ChatGPT owns planning and Issue quality.
- Claude Code owns implementation.
- Gemini owns independent research/review.
- NORIZO owns strategic/high-risk decisions; routine reversible merges should not require NORIZO.

## Handoff contract

The relevant Issue/PR is the handoff surface. No standalone active HANDOFF file is required.

## ConoHa migration rule

When Phase B/C begins, GitHub remains the semantic source of truth. ConoHa receives only validated/allowlisted executable instructions. Runtime leases, heartbeat, retry and command status may be held in Supabase.
