# NORIZO LAB Operating Constitution

Updated: 2026-09-21 JST

## 1. Single point of command

All work starts from ChatGPT ("Chatty").

Chatty is the only orchestration origin for NORIZO LAB.
No other AI, automation, GitHub workflow, or external agent may become an independent command source.

## 2. GitHub role

GitHub is a repository, history store, diff/audit surface, and backup of code and documents.

GitHub is **not** an instruction bus between AIs.

Rules:
- Do not use GitHub Issues, PR comments, mentions, labels, or GitHub Actions to dispatch work from Chatty to Claude Code, Codex, Gemini, or any other AI.
- Do not design autonomous AI-to-AI handoff around GitHub.
- GitHub Actions may be used only where a normal CI/check is independently justified; they are not the NORIZO LAB orchestration layer.
- All GitHub changes originate from a task explicitly initiated by Chatty/NORIZO.

## 3. Claude Code

Claude Code is not a standing member of the execution chain.

Default:
- Do not depend on Claude Code for normal operation.
- Use only occasionally for a clearly bounded task when specifically needed.
- Do not create any permanent Claude Code bridge, watchdog, dispatcher, or autonomous GitHub handoff.

Commercial posture:
- Downgrade to the low-cost plan from next billing period unless another independent use justifies more.

## 4. Codex

Codex is not part of the mandatory NORIZO LAB runtime chain.

Rules:
- Do not depend on Codex Cloud/GitHub mention workflows.
- Do not build a GitHub-to-Codex autonomous loop.
- Use Codex only when Chatty explicitly decides it adds value to a bounded task.

## 5. Gemini

Gemini is treated primarily as an external research/search/review tool.

Rules:
- Do not make Gemini a standing execution owner.
- Do not depend on Gemini Actions or GitHub workflows for continuity.
- Any Gemini output returns to Chatty/NORIZO for judgment.

## 6. ConoHa VPS

ConoHa is managed by Chatty for NORIZO LAB infrastructure.

Rules:
- Unnecessary AIs, agents, runners, bridges, and autonomous dispatchers must not be introduced.
- No GitHub-origin instruction system is allowed.
- Long-running work is moved to ConoHa **one job at a time** by Chatty.
- Each resident job must be independently understandable, observable, restartable, and removable.
- A resident batch must have an explicit purpose, entrypoint, state/checkpoint strategy, restart policy, log location, and stop procedure before it is considered established.
- Do not bundle unrelated jobs merely to create an "agentic" platform.

## 7. Resident batch operating rule

For each long-running task:

1. Chatty defines the job.
2. Chatty verifies the one-shot task first.
3. Only then move that single task to ConoHa.
4. Add systemd/timer/cron only as required for that job.
5. Verify health, logs, restart, checkpoint/idempotency, and failure behavior.
6. Keep GitHub only as code/document/history storage.
7. Move to the next resident task only after the current one is proven stable.

## 8. External services

Vercel, Supabase, Shopify, Google services, and other systems are operated directly from Chatty where an authorized connector/API is available.

Do not route instructions through GitHub merely to reach another service.

Vercel operating sequence remains:

Local QA → Preview only when NORIZO asks to see it → NORIZO confirmation → Production.

Production/destructive/paid/security-sensitive operations require NORIZO approval.

## 9. Human relay rule

NORIZO must not be used as a routine copy-and-paste relay between AIs.

If two AI systems cannot communicate reliably without NORIZO manually relaying prompts/results, treat them as separate tools rather than pretending they form one autonomous agentic workflow.

## 10. Architectural summary

```text
NORIZO
   ↓
ChatGPT / Chatty  ← single command origin
   ├─ GitHub      ← code / docs / history / audit only
   ├─ ConoHa      ← proven resident jobs, one by one
   ├─ Vercel      ← deployment / preview when required
   ├─ Supabase    ← data/backend operations when required
   ├─ Shopify     ← commerce operations when required
   ├─ Claude Code ← occasional bounded specialist
   ├─ Codex       ← optional bounded specialist
   └─ Gemini      ← research/search/review

Forbidden:
GitHub → AI dispatch
AI → AI autonomous relay assumed as infrastructure
GitHub Actions as the NORIZO LAB orchestration backbone
```

## 11. Core principle

Do not build NORIZO LAB around an abstract "agentic workflow".

Build each workflow around:
- one explicit owner: Chatty
- one explicit source of records: GitHub where appropriate
- direct authorized service access
- ordinary deterministic software for repeatable work
- one-by-one resident batch migration to ConoHa when persistence is actually required

Reliability takes priority over architectural novelty.
