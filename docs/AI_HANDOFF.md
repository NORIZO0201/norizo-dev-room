# AI HANDOFF — DEV ROOM P0→P5

Updated: 2026-09-21 JST

## Single source of active work
Branch: `dev-room-p0-p5`

This file is the shared ChatGPT ↔ Claude Code handoff. NORIZO is not a message relay.

## Current facts
- Mac → ConoHa SSH is already verified.
- VPS → GitHub SSH is already verified.
- `/opt/norizo` exists with four repos.
- Claude confirmed cloud-hosted sessions cannot reach ConoHa by SSH or ConoHa API due to network policy. This is expected.
- ChatGPT created the P0 control-plane database and Supabase Edge Function.
- ChatGPT added the ConoHa control agent implementation on this branch.
- `baseline.json` generation is still missing and is part of P0.
- No Production deployment is authorized.

## Existing P0 implementation on this branch
- `deploy/control-plane/telemetry_agent.py`
- `deploy/control-plane/norizo-control-agent.service`
- `deploy/control-plane/install-control-agent.sh`
- `deploy/health/health_server.py` includes the control-agent unit
- Supabase tables:
  - `dev_room_node_tokens`
  - `dev_room_node_status`
  - `dev_room_commands`
- Supabase Edge Function: `dev-room-control`

## Immediate task for Claude Code
Implement the missing Phase 0 baseline writer, without duplicating the control-plane work.

Preferred structure:
- add `scripts/write-baseline.py` or `scripts/write-baseline.sh`
- have `scripts/bootstrap-conoha.sh` call it after provisioning/verification
- write atomically to `/opt/norizo/system/baseline.json`
- preserve existing console output

Minimum fields:
- captured_at
- hostname
- OS / kernel
- CPU
- memory
- disk
- versions: git, gh, python3, node, pnpm, docker, compose, tmux, rg, claude, codex
- key systemd services
- repos under /opt/norizo with branch, HEAD SHA, dirty state
- health monitor status
- control-agent status where available

The writer must be safe to rerun independently of bootstrap.

## Snapshot rule
Before a Mac-local session runs the mutating bootstrap, take a ConoHa VPS snapshot.
The official order is:

Snapshot
→ bootstrap
→ validate baseline.json
→ validate health service
→ install/start control agent
→ validate telemetry
→ safe command round-trip
→ P0 COMPLETE

## P0 evidence to record here
When each item is proven, append timestamp and evidence:
- [ ] snapshot created
- [ ] bootstrap completed
- [ ] baseline.json valid
- [ ] health active
- [ ] control agent active
- [ ] conoha-01 token exists
- [ ] fresh telemetry received
- [ ] safe command round-trip succeeded

## P1→P5 order
Only after P0 completion:
P1 Dashboard
→ P2 OMNW resident workers
→ P3 Observation
→ P4 Projects
→ P5 GMKtec node

## Safety
No arbitrary remote shell command queue. Commands remain allowlisted.
No new public monitoring ports.
No secret material in GitHub.
