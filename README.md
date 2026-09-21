# NORIZO DEV ROOM

Development foundation for NORIZO + Chatty covering canonical project state, PC/SP browser QA, OMNW/RELIS project support, deterministic QA gates, and handoff evidence.

## Operating model

```text
NORIZO
   ↓
ChatGPT / Chatty
   ├─ GitHub        code / state / evidence
   ├─ Supabase      project data/backends
   ├─ Browser Provider
   │    ├─ steel-cloud or other available managed provider
   │    └─ playwright-compatible reachable provider when already available
   ├─ Vercel        hosting under approval rules
   └─ project APIs  Shopify / other allowlisted services
```

**ConoHa/VPS is retired and is not part of DEV ROOM.** Do not inspect, start, recreate, or depend on it.

## Canonical P1–P5 state

- Machine-readable checkpoint: `state/DEV_ROOM_STATE.json`
- Completion evidence: `docs/evidence/`
- Deterministic state validator: `node scripts/validate-phase-state.mjs`

Execution order is fixed:
1. P1 Control Room / health / canonical project state
2. P2 OMNW Discovery/Master + Consumer development support
3. P3 reusable PC/SP browser QA gate
4. P4 reusable project workers / observation contracts
5. P5 deterministic project batch/QA gates + handoff state

## Browser Provider architecture

All browser-facing DEV ROOM APIs route through `api/providers/index.mjs`; the UI must not hard-code a VPS.

Current usable modes are provider-dependent. Prefer managed tooling already available to the account, keep sessions on-demand, and collect evidence only as needed.

Required P3 coverage:
- PC and SP/mobile responsive checks
- navigation / critical route checks
- console and runtime errors
- screenshots or equivalent visual evidence
- regression verification

## Deployment policy

Vercel operations follow:

**Local/tooling QA → Preview only when NORIZO asks → NORIZO confirmation → Production**

Do not create a Preview merely because a small change was made. Group local changes into review sets.

## Security and cost

- Never commit secrets or tokens.
- Keep browser viewer/debug URLs private.
- Start paid browser sessions only when needed and stop them promptly.
- Prefer structured APIs over browser automation for data collection.
- Do not add a paid service or material new spend without explicit approval.
