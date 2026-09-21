# ConoHa DEV Baseline

Updated: 2026-09-21 JST

## Purpose

Use ConoHa VPS as NORIZO's persistent DEV worker for Claude Code, Codex CLI, GitHub, Docker, long-running jobs, QA, builds, and project automation.

This repository is the DEV-side source of truth for operating rules and non-secret configuration.

## Current VPS

- Provider: ConoHa VPS 3.0
- Region/API endpoint family: c3j1
- Plan: 12 GB RAM / 6 vCPU
- Boot storage: SSD 100 GB
- OS baseline: Ubuntu 24.04 LTS
- Security group baseline: SSH only until a service explicitly needs another port
- Public server IP: intentionally not committed here
- Existing VPS name tag: recorded in ConoHa control panel

## SSH

### Canonical key (current operating policy)

The current VPS was created with this key, and the Mac connects with this same key.
There is one key, used from one place, and it is the only key this baseline depends on.

- ConoHa SSH Key name: `key-2026-09-21-08-53`
- Private key filename: `key-2026-09-21-08-53.pem`
- Mac private key location: local `Conoha` working folder (path recorded in the Mac
  SSH config, not committed here)
- Login user: `root`
- Private key must never be copied to GitHub, chat, shared Drive, or another server.

Mac connection is configured in `~/.ssh/config` as `Host conoha`, so `ssh conoha` is
the single entry point. `IdentitiesOnly yes` is set so the correct key is always used.

### `NORIZO-MacBook-Pro`

- Not used in current operation.
- Do not migrate to it. Do not treat its absence as a defect to be repaired.
- An earlier revision of this document named it the canonical key. That plan was not
  carried out and has been withdrawn.

### Key rotation policy

Creating a new SSH key, or rotating the existing one, is allowed only when both of the
following are true:

1. There is a stated, concrete reason (suspected compromise, personnel change,
   or a documented security requirement).
2. A migration plan exists that adds the new key and verifies login with it **before**
   the old key is removed.

Never rebuild or recreate an existing VM in order to change its SSH key. Adding a key
to `authorized_keys` achieves the same result without destroying the machine.

## ConoHa API

An API user has been created in the ConoHa VPS control panel.

The following values exist and are intentionally NOT committed to this public repository:

- Tenant ID
- API User ID
- API password
- Public server IP where unnecessary

Authoritative locations:
1. ConoHa control panel for tenant/user identifiers and endpoints.
2. Local secret environment / password manager for the API password.
3. Never place the API password in this repository.

Identity endpoint family:
- `https://identity.c3j1.conoha.io/v3`

Compute endpoint family:
- `https://compute.c3j1.conoha.io/v2.1`

## Preferred Control Path

Priority order:

1. ConoHa official MCP server, if it supports the required VPS operation reliably.
2. ConoHa VPS 3.0 REST API.
3. SSH into the VPS for OS/application work.
4. Browser VNC console only as emergency recovery.

Do not use the VNC console for routine provisioning when API/MCP/SSH can perform the operation.

This priority order assumes a Mac-local session. None of it is reachable from a cloud
session -- see **Execution Environment** below before attempting any of it.

## Execution Environment (read before attempting ConoHa access)

Claude Code, Codex CLI, and any other agent can run in one of two places. The window
being typed into is not the same thing as the machine that executes the work. Confusing
the two leads to the false conclusion that ConoHa access is broken or misconfigured.

### The two environments

| | Mac-local session | Cloud session |
| --- | --- | --- |
| Where the work actually runs | this Mac | ephemeral Linux container, Anthropic-hosted |
| How it is started | `claude` in Terminal; desktop app opened on a local folder | claude.ai/code; desktop app opened on a cloud environment |
| `ssh conoha` | works | impossible: outbound port 22 blocked, and no private key exists there |
| ConoHa REST API | works | blocked: egress proxy answers 403 for `*.conoha.io` and `api.conoha.jp` |
| ConoHa MCP server | usable once authorized | unreachable: the same 403 applies before authorization is even relevant |

The desktop app is a client, not an environment. Opening Claude Code from the desktop app
does **not** by itself mean the session runs on the Mac. A desktop-app session pointed at a
cloud environment carries every cloud restriction in the table above.

### How to identify the current environment

Run both commands:

```
hostname
ls /Users
```

- macOS hostname, and `/Users` lists -> Mac-local session. ConoHa work is possible.
- hostname `vm`, and `ls /Users` reports `No such file or directory` -> cloud session.
  ConoHa work is impossible. Stop and reopen the task in a Mac-local session.

Additional cloud markers: working directory under `/home/user/`, `HTTPS_PROXY` pointing at
a local port, `~/.ccr/` present, `~/.ssh/` empty.

### Rule

ConoHa operations -- MCP, REST API, SSH, provisioning, and any deployment onto the VPS --
are performed only from a Mac-local session. In a cloud session, restrict work to editing
code and pushing to GitHub, and leave VPS steps to a Mac-local session.

### A cloud session's failure to reach ConoHa is not a defect

It is the expected result of this baseline's own security design. Do not "repair" it:

- The empty `~/.ssh/` is correct. The private key is deliberately held on the Mac only
  (see the SSH section). Never generate a replacement key, copy a key into the container,
  or commit a key in order to unblock a cloud session.
- The 403 is a network policy decision, not an outage and not a ConoHa-side fault. Do not
  retry it as though it were transient, and never disable TLS verification or unset the
  proxy to get around it.
- Authorizing the ConoHa MCP server does not help in a cloud session, because the 403
  applies at the network layer first.

Verified 2026-09-21 JST from a cloud session: `identity.c3j1.conoha.io:443` and
`api.conoha.jp:443` were both rejected at CONNECT with 403, and outbound TCP port 22 was
blocked.

## Target DEV Stack

Provision toward:

- Git / GitHub
- Claude Code
- Codex CLI
- Gemini CLI when useful
- Node.js
- pnpm
- Python
- Docker Engine + Docker Compose
- tmux
- jq / ripgrep / build tools
- fail2ban / UFW
- project workspaces under a consistent DEV root

## Deployment Constitution

For all DEV projects:

`local/ConoHa QA -> Preview only when needed -> NORIZO confirmation -> Production`

Rules:

- Do not create a Vercel Preview for every small edit.
- Group related changes into a confirmation set.
- If NORIZO says "見せて", "確認したい", or "プレビュー出して", create Preview at that point and provide the URL.
- Production only after Preview confirmation where applicable, lint/typecheck/build, key-screen QA, and explicit NORIZO approval.

## Baseline Status

Verified 2026-09-21 JST. The current VPS is kept as-is; it is not rebuilt.

| Item | Status |
| --- | --- |
| Mac -> ConoHa SSH (`ssh conoha`) | verified, from a Mac-local session |
| OS | Ubuntu 24.04.5 LTS |
| VPS -> GitHub SSH (`norizo_conoha_github_ed25519`) | verified |
| DEV root `/opt/norizo` | created |
| Project repos placed | 4 (see below) |

Repos under `/opt/norizo`, all on `main` and in sync with `origin/main`, remotes over
SSH (`git@github.com:NORIZO0201/<repo>.git`):

- `norizo-dev-room`
- `oh-my-nihon-wine`
- `local-engine`
- `sayaka-kitchen`

VPS-side SSH files created during this work: `/root/.ssh/known_hosts` (GitHub host key,
fingerprint checked against GitHub's published value) and `/root/.ssh/config` (a single
`Host github.com` entry). Existing keys and `authorized_keys` were not modified.

## Next Infrastructure Action

Do not continue manual VNC provisioning. Do not rebuild the VPS.

Phased rollout:

| Phase | Scope |
| --- | --- |
| 0 | Audit and complete the DEV stack; write `/opt/norizo/system/baseline.json` |
| 1 | Common Health Monitor under `/opt/norizo/system/health/` as the first resident service |
| 2 | Turn existing OMNW code into resident workers (Discovery first) |
| 3 | Steel Self-host, only once a step genuinely needs a browser |
| 4 | RELIS / LOCAL ENGINE observation workers, reusing the Phase 2 worker base |
| 5 | SAYAKA / Cheese / CNW deterministic batches |

Phase order is deliberate: monitoring exists before resident work is added, so a stalled
worker is visible from the moment it is deployed.

### Browser automation ordering

API, RSS, sitemap, JSON-LD and other structured sources are used before browser
automation. Steel Self-host is introduced when a specific step is shown to require a
browser, not in advance.

## Security Rule

This file contains no credentials by design.

Never commit:
- passwords
- API tokens
- private SSH keys
- Vercel/Supabase/Shopify secrets
- OAuth client secrets
- recovery codes

Use environment variables or a dedicated secret store for those values.
