# CLAUDE.md — NORIZO DEV ROOM

## Active shared branch
Work only on `dev-room-p0-p5` unless this file explicitly changes.

## Shared coordination
Before doing any work, read:
1. `docs/AI_HANDOFF.md`
2. `docs/CONOHA_DEV_BASELINE.md`
3. `docs/P0_P5_RUNBOOK.md`
4. `docs/DEV_ROOM_ARCHITECTURE.md`

GitHub is the coordination bus between ChatGPT and Claude Code.
Do not ask NORIZO to relay messages between agents.

## Execution environment rule
If the current Claude Code session is cloud-hosted, do not attempt ConoHa SSH/API access.
Cloud sessions may edit code and push to GitHub only.
ConoHa OS-level work must run from a verified Mac-local session.

Never:
- generate replacement SSH keys to unblock cloud execution;
- copy private keys into cloud environments;
- disable TLS/proxy controls;
- retry known network-policy 403s;
- use VNC for routine provisioning.

## P0 completion gate
P0 is NOT complete until all of these are proven:
1. `/opt/norizo/system/baseline.json` exists and is valid JSON.
2. `norizo-health.service` is active.
3. `norizo-control-agent.service` is active and persistent.
4. Supabase contains a `conoha-01` node token.
5. Supabase `dev_room_node_status` receives fresh telemetry from `conoha-01`.
6. One safe allowlisted command is leased, executed, and acknowledged successfully.

Do not call P0 complete based only on code or configuration.

## Deployment rule
ConoHa/local QA first.
No Vercel Preview unless NORIZO asks to see it.
No Production deployment without explicit NORIZO approval.
