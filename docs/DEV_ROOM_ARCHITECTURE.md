# NORIZO DEV ROOM Architecture

Updated: 2026-09-21 JST

## Purpose

DEV ROOM is NORIZO LAB's development and operations surface.

Chatty is the command origin. DEV ROOM provides browser QA, resident-job visibility, and project status. It is not an AI-to-AI coordination system.

## Roles

| Component | Role |
| --- | --- |
| NORIZO | Owner / final approval for high-risk decisions |
| ChatGPT / Chatty | Single normal command origin, planning, QA, direct service operations |
| GitHub | Code, docs, diffs, history, audit only |
| ConoHa VPS | Deterministic resident jobs and Steel self-host |
| Steel self-host | PC/SP browser development and QA base |
| Supabase | Project data/backends where required |
| Vercel | App hosting / Preview / Production under deployment rules |
| Shopify | CWS commerce system |
| Claude Code / Codex | Optional bounded specialist tools only |
| Gemini | Optional research/search/review tool only |

## Architecture

```text
NORIZO
   ↓
ChatGPT / Chatty
   ├─ GitHub      code / docs / history
   ├─ ConoHa
   │    ├─ resident batch A
   │    ├─ resident batch B
   │    ├─ health / logs
   │    └─ Steel self-host
   │          ├─ PC QA
   │          └─ SP QA
   ├─ Supabase
   ├─ Vercel
   └─ Shopify
```

## Resident workload policy

Do not create a generic autonomous factory.

For each heavy job:
1. prove the one-shot job
2. define checkpoint/idempotency
3. move that job to ConoHa
4. add only the scheduler/service it needs
5. verify logs, restart and failure behavior
6. then consider the next job

## Browser QA policy

Steel self-host is the default browser base for PC/SP development where browser execution is required.

- PC viewport and SP/mobile fingerprint are separate QA sessions/profiles.
- Prefer structured APIs over browser automation for data collection.
- Keep 9223 private.
- Use Steel Cloud only if a managed capability is specifically required and approved.

Steel Local/self-host supports one concurrent session according to current official documentation, so routine PC/SP QA should run sequentially unless a later need justifies another provider.

## GitHub policy

GitHub is not a command bus.

Do not restore:
- `@claude` dispatch
- `@codex` dispatch
- Gemini PR review automation
- GitHub Actions that invoke AI agents
- resident services that poll GitHub for natural-language instructions

## Deployment

Vercel:

Local/ConoHa QA → Preview only when NORIZO asks → NORIZO confirmation → Production.

## Safety

High-risk, Production, destructive, paid, DNS, secret/key, or VPS-rebuild operations require NORIZO approval.
