# DEV ROOM P0→P5 24/7 Runbook

## Fixed order
P0 Control Plane → P1 Dashboard → P2 OMNW resident work → P3 Observation → P4 Projects → P5 GMKtec.

Do not begin P1 or later until every P0 completion gate below is proven on the real VPS.

## P0
- Supabase project: local-engine
- tables: dev_room_node_tokens / dev_room_node_status / dev_room_commands
- Edge Function: dev-room-control
- ConoHa node id: conoha-01
- Agent interval: 30s
- Health endpoint remains loopback-only.
- Bootstrap is accepted only from the registered ConoHa public IPv4.
- The node receives a one-time token and stores it root-only under /etc/norizo/node-token.
- Commands are allowlisted; arbitrary shell execution is forbidden.

### P0 host order
1. Create/confirm the ConoHa snapshot.
2. Run `scripts/p0-converge.sh` with `NORIZO_SNAPSHOT_CONFIRMED=1`.
3. Confirm `/opt/norizo/system/baseline.json` is valid.
4. Confirm `norizo-health.service` is active/persistent.
5. Confirm `norizo-control-agent.service` is active/persistent.
6. Confirm `/etc/norizo/node-token` exists root-only.
7. Confirm fresh `conoha-01` telemetry in Supabase.
8. Complete one safe allowlisted `health_snapshot` command round-trip.
9. Only then mark P0 complete.

### P0 tool-stack decision
Node.js, pnpm, Claude Code CLI and Codex CLI are recorded by `baseline.json` and may remain explicit `stack_gaps` during P0. They are not P0 completion gates because the resident control plane is Python/systemd. Do not add package-manager churn during P0 merely to make these optional development tools appear present.

The VPS-resident Claude orchestrator is also not a P0 gate and must not be installed or activated during P0.

## Stop-resistance
- systemd Restart=always for the control agent.
- systemd Restart=always for the health service.
- health service starts before resident workers.
- worker lanes must use Restart=on-failure and checkpoint/idempotent semantics unless their lane specification explicitly requires stronger persistence.
- exit 75 means HOLD / human review and must not restart-loop.
- no public monitoring port is opened.

## P2 gating rule
Do not invent a worker executable. Audit the OMNW repository and bind a lane only after its one-shot entrypoint, DB write target, checkpoint and retry semantics are proven.

## Deployment rule
ConoHa QA first. Vercel Preview only when NORIZO asks to see it. Production requires explicit approval.
