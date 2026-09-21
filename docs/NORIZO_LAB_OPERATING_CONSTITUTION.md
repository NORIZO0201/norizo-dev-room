# NORIZO LAB Operating Constitution

Updated: 2026-09-22 JST

## 1. Single point of command

All work starts from ChatGPT ("Chatty"). NORIZO → Chatty is the normal command path.
No other AI, automation, GitHub workflow, or external agent becomes an independent command source.

## 2. GitHub role

GitHub is code/document/history/checkpoint/audit storage.
It is not an instruction bus between AIs.

- Do not dispatch work to Claude Code, Codex, Gemini, or another AI through Issues, PR comments, mentions, labels, or Actions.
- GitHub Actions are permitted only as ordinary deterministic CI/checks.
- Historical implementation details belong in Git history rather than executable tombstones in the live tree.

## 3. External AI tools

Claude Code, Codex, and Gemini are optional bounded specialists.
They are not standing runtime owners and must not create self-sustaining handoff loops.

## 4. Retired infrastructure

ConoHa/VPS is retired and must not be checked, started, rebuilt, recreated, or replaced merely to preserve an old architecture.

The live DEV ROOM tree must not contain:
- ConoHa setup/provisioning scripts;
- VPS/systemd health services;
- resident worker installers or systemd units tied to the retired host model;
- DEV ROOM Watchdog/Executor machinery whose only purpose was to drive P1–P5 continuously.

Git history remains the audit record.

## 5. DEV ROOM lifecycle

P1–P5 are a completed reusable development foundation.

Normal mode after completion is **on-demand maintenance**, not permanent hourly DEV ROOM execution:
- deterministic state/contract QA runs when the foundation changes;
- browser QA runs when a project needs PC/SP verification;
- project-specific workers run under their own project contracts;
- DEV ROOM itself does not need a Watchdog watching an Executor.

This prevents duplicated monitoring, unnecessary Actions/automation runs, and stale state accumulation.

## 6. Reusable long-running work

If a project genuinely needs continuous or scheduled work, keep it project-owned and provider-neutral.

Each such worker must have:
- explicit purpose and owner;
- checkpoint/idempotency semantics;
- heartbeat/observation contract where useful;
- safe restart behavior;
- bounded cost and allowlist;
- explicit stop/removal rule.

Do not bundle unrelated workloads into a generic resident "AI factory".

## 7. External services

Vercel, Supabase, Shopify, Google services, and other systems are operated directly through authorized connectors/APIs where available.

Vercel sequence:

Local QA → Preview only when NORIZO asks to see it → NORIZO confirmation → Production.

Production/destructive/paid/security-sensitive operations require explicit NORIZO approval.

## 8. Human relay rule

NORIZO must not be used as routine copy-and-paste relay between AIs.
If two AI systems cannot communicate reliably without manual relaying, treat them as separate tools.

## 9. Architectural summary

```text
NORIZO
   ↓
ChatGPT / Chatty
   ├─ GitHub       code / docs / history / checkpoint
   ├─ Supabase     project data / deterministic backend
   ├─ Browser QA   local or approved managed provider
   ├─ Vercel       hosting under approval rules
   ├─ Shopify      commerce integrations where authorized
   ├─ Claude Code  occasional bounded specialist
   ├─ Codex        optional bounded specialist
   └─ Gemini       research/search/review

Not part of the architecture:
ConoHa/VPS
DEV ROOM hourly Watchdog/Executor
GitHub → AI dispatch
AI → AI autonomous relay
```

## 10. Core principle

Keep the live system smaller than its history.
Completed scaffolding is removed from the active tree; reusable contracts and deterministic QA remain.
Reliability, low cost, and clear ownership take priority over architectural novelty.
