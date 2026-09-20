# NORIZO DEV ROOM

Shared PC/SP browser development room for NORIZO + AI agents.

## Browser Provider architecture

```
DEV ROOM
   ↓
Browser Provider
   ├─ steel-cloud       ← current default
   ├─ steel-selfhost    ← low-cost future option
   └─ playwright-local  ← local / own-machine option
```

All top-level APIs route through `api/providers/index.mjs`. The DEV ROOM UI does not depend directly on Steel Cloud.

## Current operating policy

- Keep `BROWSER_PROVIDER=steel-cloud` while the initial Steel credit remains.
- Measure actual browser-hours and real usage before paying for infrastructure.
- When the free credit is nearly exhausted, compare:
  1. continue Steel Cloud pay-as-you-go;
  2. run Steel OSS on a small VPS;
  3. run Playwright on a local/owned machine.
- Prefer the lowest-maintenance option unless usage makes self-hosting materially cheaper.

## Provider configuration

### 1. Steel Cloud — current

Vercel environment variables:

```
BROWSER_PROVIDER=steel-cloud
STEEL_API_KEY=...
```

If `BROWSER_PROVIDER` is omitted, `steel-cloud` is used.

### 2. Steel Self-host

```
BROWSER_PROVIDER=steel-selfhost
STEEL_SELFHOST_API_BASE=http(s)://your-steel-host/v1
STEEL_SELFHOST_CDP_BASE=ws(s)://your-steel-host/connect
STEEL_SELFHOST_API_KEY=...        # optional if your self-host has no auth
```

The self-host adapter deliberately keeps the same DEV ROOM API surface as Steel Cloud.

### 3. Playwright Local

```
BROWSER_PROVIDER=playwright-local
PLAYWRIGHT_WS_ENDPOINT=ws://...
PLAYWRIGHT_VIEWER_BASE=http://... # optional; needed for human live viewing
```

This is intended for a future NORIZO Local Bridge or an owned browser host. On Vercel, `localhost` is not the user's Mac, so a reachable bridge endpoint is required.

## Current capabilities

- PC + SP browser sessions
- PC/SP URL linking
- human-interactive live viewers when supported by provider
- QA inspection
- session renewal
- project presets
- provider status shown inside DEV ROOM

## Cost policy

The DEV ROOM should not keep paid browser sessions alive unnecessarily.

Planned/required controls:
- start sessions only on demand;
- release sessions on STOP / page close;
- add idle auto-stop;
- allow PC-only or SP-only mode;
- show provider + usage/cost status in the DEV ROOM.

## Security

Browser viewer/debug URLs can effectively grant live access to a session. Keep DEV ROOM access private and protect production access before sharing outside the owner/admin group.
