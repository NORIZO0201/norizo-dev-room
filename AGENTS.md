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
- audit trail

Do not use Issues, PR comments, mentions, labels, or GitHub Actions to dispatch work to Claude Code, Codex, Gemini, or any other AI.

## External AI tools
Claude Code, Codex, and Gemini may be used only for bounded, explicitly requested work.
They are not standing owners and must not create self-sustaining handoff loops.

## ConoHa
ConoHa is a deterministic resident-workload host.

- No GitHub-origin free-form task execution.
- No resident AI orchestrator.
- Move long-running jobs one at a time.
- Verify one-shot behavior before residency.
- Every resident job needs checkpoint/idempotency, bounded retry, logs, restart behavior, and a stop/removal procedure.

## Steel
Self-hosted Steel may be used as the browser-development and QA substrate for PC/SP work.
Keep its API/debugging surfaces private and never expose browser-control ports directly to the public internet.

## Deployment safety
Vercel flow:
Local/ConoHa QA → Preview only when NORIZO asks → NORIZO confirmation → Production.

Explicit NORIZO approval is required for:
- Production deployment
- destructive data deletion
- DNS changes
- secret/key rotation
- VPS rebuild/recreate
- new paid services or material paid API usage

Never commit secrets, tokens, passwords, or private keys.
