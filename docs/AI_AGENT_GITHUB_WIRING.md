# AI Agent GitHub Wiring

This repository wires the official Claude Code and Gemini CLI GitHub Actions.

- Claude: mention `@claude` in an Issue or PR conversation.
- Gemini: PRs trigger review automatically; `@gemini-cli /review` requests another review.
- GitHub `main` remains the Source of Truth.
- No GitHub Issue/PR text is passed directly to a shell outside the official agent Actions.
- Production, destructive, paid, DNS, secret/key and other high-risk operations still require NORIZO approval.

Authentication secrets are intentionally not committed:
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

If either secret is absent, the workflow trigger still proves the wiring path and reports the authentication gate in GitHub.
