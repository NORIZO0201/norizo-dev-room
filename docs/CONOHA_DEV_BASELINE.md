# ConoHa DEV Baseline

Updated: 2026-09-21 JST

## Purpose

ConoHa is NORIZO LAB's persistent execution host for **ordinary deterministic resident jobs** and self-hosted Steel Browser.

It is not an autonomous AI-agent host and does not receive instructions from GitHub Issues, PR comments, labels, or Actions.

## Current VPS

- Provider: ConoHa VPS 3.0
- OS: Ubuntu 24.04 LTS
- Plan: 6 vCPU / 12 GB RAM
- Boot storage: 100 GB
- Daily backup: enabled, 14-day retention
- Security baseline: do not add public browser-control/admin ports
- Existing host is preserved; do not rebuild it for routine changes

## Operating model

NORIZO → ChatGPT / Chatty → direct infrastructure/service operations.

Long-running work is migrated to this VPS one job at a time.

Every resident job must have:
- one-shot entrypoint proven first
- explicit read/write targets
- checkpoint/idempotency strategy
- bounded retry/backoff
- health/log evidence
- restart policy
- stop/removal procedure

No resident AI orchestrator is permitted.

## Core stack

Required:
- Linux / systemd
- Python
- Node.js when a workload requires it
- Docker Engine + Docker Compose
- Git for code checkout and version history
- jq / ripgrep / standard build tools
- health monitoring
- Steel Browser self-host for PC/SP browser QA

Optional tools such as Claude Code, Codex CLI, or Gemini CLI are not infrastructure dependencies and are not required on the VPS.

## GitHub boundary

GitHub is code/document/history/audit storage.

Forbidden:
- GitHub Issue → shell
- GitHub PR comment → AI runner
- GitHub Action → AI dispatcher
- GitHub polling as a general command queue

A resident workload may pull versioned code from GitHub, but its runtime instructions and schedules are local deterministic configuration.

## Steel Browser

Steel self-host is the standard browser-development/QA substrate for DEV ROOM.

Official Steel self-host requirements are at least 4 GB RAM and 10 GB free disk. This VPS exceeds those requirements.

Security:
- bind Steel API to loopback/private access
- never expose Chrome debugging port 9223 publicly
- do not expose Steel API publicly without an authenticated gateway
- browser sessions are development/QA infrastructure, not a public product endpoint

## Vercel

Deployment flow remains:

Local/ConoHa QA → Preview only when NORIZO asks → NORIZO confirmation → Production.

## Security

Never commit:
- passwords
- API tokens
- private SSH keys
- Vercel/Supabase/Shopify secrets
- OAuth secrets
- recovery codes

Production/destructive/paid/security-sensitive operations require NORIZO approval.
