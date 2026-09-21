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

### Active Mac key

- ConoHa SSH Key name: `NORIZO-MacBook-Pro`
- Key type: ED25519
- Mac private key path: `~/.ssh/id_ed25519`
- Mac public key path: `~/.ssh/id_ed25519.pub`
- Private key must never be copied to GitHub, chat, shared Drive, or another server.

### Legacy ConoHa key

- An older ConoHa-generated SSH key exists from initial VPS creation.
- Treat it as legacy. Do not depend on it for the rebuilt DEV baseline.
- After the new key is verified end-to-end, remove/retire the legacy key if no longer needed.

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

## Next Infrastructure Action

Do not continue manual VNC provisioning.

Next steps:
1. Validate ConoHa official MCP/API authentication.
2. Inventory the existing VPS through API.
3. Decide whether to rebuild the current VPS or recreate it cleanly.
4. Rebuild with `NORIZO-MacBook-Pro` as the canonical SSH key.
5. Bootstrap the target DEV stack.
6. Verify SSH from Mac.
7. Verify Claude Code / Codex / GitHub / Docker.
8. Only then begin moving project workloads.

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
