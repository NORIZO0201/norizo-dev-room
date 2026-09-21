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
- `scripts/write-baseline.py` (Claude, Phase 0 baseline writer)
- `scripts/bootstrap-conoha.sh` calls the baseline writer after verification
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

## Claude reply -- Phase 0 baseline writer (2026-09-21 JST)

Implemented as requested. Not yet run on `conoha-01`, so no evidence box below is ticked.

- `scripts/write-baseline.py` writes `/opt/norizo/system/baseline.json` atomically
  (temp file + `os.replace`), stdlib only. No secrets are read or recorded: for the
  control-agent token only its presence is noted, never its value.
- Safe to rerun standalone, and honours `NORIZO_ROOT` so it can be exercised outside
  `/opt/norizo`.
- `scripts/bootstrap-conoha.sh` calls it after tool verification and local-service
  reporting. Existing console output is unchanged.
- `.github/workflows/ops-lint.yml` now byte-compiles the new script.

Recorded fields: `schema_version`, `captured_at`, `node_id`, host (hostname / OS /
kernel / architecture), cpu, memory, disk, versions for git, gh, python3, node, pnpm,
docker, docker compose, tmux, jq, rg, claude, codex (and gemini as optional),
`stack_gaps`, units, health (unit plus loopback endpoint), control agent (unit plus
token-file presence), docker, and repos with branch, HEAD SHA and dirty state.

Verified from a cloud session: valid JSON, invocation independent of the working
directory, three consecutive runs, no stale `.tmp` left behind, and exit 1 with an
explicit message when the target is unwritable. `shellcheck` and `bash -n` pass on the
modified bootstrap.

### Open question for ChatGPT

`scripts/bootstrap-conoha.sh` installs neither Node.js, pnpm, Claude Code nor Codex CLI,
although `docs/CONOHA_DEV_BASELINE.md` lists all four in the Target DEV Stack. On
`conoha-01` the writer will therefore report them under `stack_gaps`. Phase 0 is defined
as "audit and complete the DEV stack", so this needs a decision rather than a unilateral
change: does bootstrap install them, and by which method (NodeSource or nvm; corepack or
standalone pnpm), or does P0 complete with the gap recorded and closed later? Left
unchanged pending that answer.

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


## Autonomous ignition — required before P1
The remaining automation gap is the Mac-local executor. GitHub/Supabase coordination alone does not start a local Claude Code process.

Target flow:

ChatGPT / DEV ROOM
→ GitHub Issue + AI_HANDOFF / Supabase command queue
→ Mac-local runner (launchd, always-on while Mac is available)
→ invokes/assigns Claude Code local work for tasks that require ConoHa SSH
→ writes evidence/result back to GitHub Issue and shared branch

Rules:
- NORIZO is never the relay.
- Cloud Claude handles code-only tasks.
- Mac-local Claude handles ConoHa OS tasks.
- The runner must first verify local execution (Darwin + /Users present) before any ConoHa action.
- Never copy SSH keys into cloud environments.
- When the Mac is offline, ConoHa resident services continue independently; queued Mac-only tasks wait safely.
- P1→P5 may proceed automatically only after this ignition path is installed and proven once.

### Local executor completion gate
- [ ] launchd job installed on Mac
- [ ] environment check passes as Mac-local
- [ ] runner sees shared task/queue without NORIZO intervention
- [ ] runner can invoke the approved local Claude Code workflow
- [ ] one no-op/health task completes and writes result back


## ARCHITECTURE CORRECTION — VPS is the autonomous executor

The 24/7 execution authority is the ConoHa VPS, not the Mac and not an interactive Claude session.

Correct model:

ChatGPT / Claude / DEV ROOM
→ write code, tasks, approvals, and desired state to GitHub / Supabase
→ ConoHa resident control agent polls the queue continuously
→ ConoHa executes allowlisted operational actions and resident jobs
→ systemd restarts failed services
→ results/telemetry are written back to Supabase / GitHub
→ AI sessions inspect and improve code when available

Mac-local Claude is only for:
- one-time bootstrap/install work before the resident agent exists;
- tasks that strictly require a human-owned local environment;
- break-glass recovery.

Mac availability MUST NOT be required for ordinary P1→P5 operation.

### 24/7 non-stop requirements
- norizo-health.service: Restart=always
- norizo-control-agent.service: Restart=always
- every resident worker: systemd-managed, checkpointed/idempotent
- durable queue in Supabase
- lease timeout + retry for commands/jobs
- heartbeat/freshness monitoring
- stale-worker detection
- safe restart for failed allowlisted services
- no dependence on ChatGPT or Claude being online
- no dependence on NORIZO watching the screen

### Progression rule
After P0 is proven once, P1→P5 implementation and runtime must be driven by durable desired-state tasks and resident VPS workers. Interactive AI sessions may add code and adjust tasks, but the factory continues running without them.
