# DEV ROOM P0→P5 24/7 Runbook

## Fixed order
P0 Control Plane → P1 Dashboard → P2 OMNW resident work → P3 Observation → P4 Projects → P5 GMKtec.

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

## Stop-resistance
- systemd Restart=always for the control agent.
- health service starts before resident workers.
- worker lanes must use Restart=on-failure and checkpoint/idempotent semantics.
- exit 75 means HOLD / human review and must not restart-loop.
- no public monitoring port is opened.

## P2 gating rule
Do not invent a worker executable. Audit the OMNW repository and bind a lane only after its one-shot entrypoint, DB write target, checkpoint and retry semantics are proven.

## Deployment rule
ConoHa QA first. Vercel Preview only when NORIZO asks to see it. Production requires explicit approval.
