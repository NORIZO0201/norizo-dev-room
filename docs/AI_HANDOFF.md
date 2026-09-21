# AI HANDOFF — DEV ROOM P0

Updated: 2026-09-21 JST

## Canonical active scope
Branch: `dev-room-p0-p5`

P0 only. Do not start P1–P5 until every P0 gate is proven on the real ConoHa VPS.
GitHub is the ChatGPT ↔ Claude Code handoff. NORIZO is not a message relay.

## Architecture authority
The ConoHa VPS is the 24/7 execution authority.

ChatGPT / Claude / DEV ROOM
→ GitHub + Supabase desired state
→ ConoHa resident control agent
→ allowlisted operations / resident workers
→ telemetry and results back to Supabase / GitHub

Mac-local Claude is bootstrap/break-glass only. Mac availability must not be required for ordinary 24/7 runtime.
The experimental VPS Claude orchestrator is NOT part of P0 and must not be installed or activated during P0.

## Verified external facts
- Mac → ConoHa SSH was verified previously.
- VPS → GitHub SSH was verified previously.
- `/opt/norizo` has the project repositories.
- ConoHa server is ACTIVE at the registered public IPv4.
- ConoHa daily backup is active.
- Supabase project `local-engine` is ACTIVE_HEALTHY.
- `dev-room-control` Edge Function is ACTIVE.
- `dev_room_node_tokens`, `dev_room_node_status`, and `dev_room_commands` exist with RLS enabled.
- As of this update, all three control-plane tables contain zero rows: the resident agent has not bootstrapped yet.
- The currently connected ConoHa API surface does not expose snapshot creation or arbitrary host shell execution.

## P0 implementation present on this branch
- `scripts/write-baseline.py`
  - atomic `/opt/norizo/system/baseline.json`
  - no secret values recorded
  - independently rerunnable
  - records host/resources/tool versions/systemd/repos/health/control-agent state
- `scripts/bootstrap-conoha.sh`
  - converges from `dev-room-p0-p5`, not stale `main`
  - refuses dirty DEV ROOM checkout with exit 75
  - installs/verifies the loopback health service
  - writes and validates `baseline.json`
  - opens no public monitoring port
- `scripts/p0-converge.sh`
  - refuses to run unless `NORIZO_SNAPSHOT_CONFIRMED=1`
  - runs bootstrap
  - verifies baseline + health
  - installs/starts control agent
  - waits for root-only node token
  - refreshes baseline after the control agent is active
- `deploy/health/norizo-health.service`
  - `Restart=always`
  - loopback-only health endpoint
- `deploy/control-plane/norizo-control-agent.service`
  - `Restart=always`
  - 30-second telemetry interval
- `deploy/control-plane/telemetry_agent.py`
  - IP-gated one-time bootstrap
  - root-only local token
  - allowlisted commands only
  - no arbitrary shell queue

## Tool-stack decision
Resolved: Node.js, pnpm, Claude Code CLI, and Codex CLI are audit-visible `stack_gaps`, not P0 completion gates.
The P0 resident control plane is Python/systemd. Do not add package-manager churn during P0 merely to close these optional development-tool gaps.

## Mandatory P0 order
1. Create/confirm a ConoHa snapshot immediately before the mutating host convergence.
2. Run the snapshot-gated host convergence.
3. Prove `/opt/norizo/system/baseline.json` is valid on the VPS.
4. Prove `norizo-health.service` is active/persistent.
5. Prove `norizo-control-agent.service` is active/persistent.
6. Prove `conoha-01` token exists.
7. Prove fresh telemetry arrives in `dev_room_node_status`.
8. Complete one safe allowlisted `health_snapshot` command round-trip.
9. Mark P0 complete only after all eight gates are evidenced.

## Current P0 evidence
- [ ] snapshot created immediately before convergence
- [ ] host convergence completed
- [ ] baseline.json valid on VPS
- [ ] health active/persistent
- [ ] control agent active/persistent
- [ ] conoha-01 token exists
- [ ] fresh telemetry received
- [ ] safe command round-trip succeeded

No evidence box may be checked from repository code alone.

## Current blocker
The code-side P0 preparation is ready, but the mandatory pre-bootstrap ConoHa snapshot and the first host-side convergence have not been executed/proven. The connected ConoHa API does not expose either snapshot creation or shell execution, so this gate cannot be truthfully marked complete from a cloud ChatGPT/Claude session.

Once the snapshot and host convergence occur, ChatGPT can complete the remaining Supabase-side verification and safe command round-trip without NORIZO relaying messages.

## Safety
- No Production deployment.
- No Vercel Preview unless NORIZO explicitly asks to see one.
- No arbitrary remote shell queue.
- No public monitoring port.
- No secrets in GitHub.
- No P1–P5 work before P0 completion.


## P0 COMPLETION EVIDENCE — 2026-09-21 JST

P0 is COMPLETE.

Verified on the actual ConoHa VPS and control plane:
- [x] snapshot-before-bootstrap rule followed by NORIZO before the mutating bootstrap
- [x] bootstrap completed on the VPS
- [x] `/opt/norizo/system/baseline.json` generated and displayed on the VPS
- [x] `norizo-health.service` active
- [x] `norizo-control-agent.service` active
- [x] `conoha-01` node token exists in Supabase
- [x] fresh telemetry received; node status became `online`
- [x] safe allowlisted command round-trip succeeded:
      `health_snapshot` leased by `conoha-01`, executed with code 0, and returned `done`
      with live health showing both health/control-agent units active

P0 completion is based on live execution evidence, not code presence alone.

Operational consequence:
- Routine operation no longer depends on NORIZO manually running `ssh conoha`.
- The ConoHa resident control agent and systemd services are now the 24/7 execution substrate.
- Any future manual Mac-local SSH is break-glass/recovery only, not normal operation.
