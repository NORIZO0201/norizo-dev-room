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
   │    ├─ local Chrome/Chromium via CDP (default zero-extra-cost path)
   │    └─ steel-cloud managed browser when an account key is already available
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

## Browser QA architecture

P3 has two provider paths and neither requires a VPS:

- `npm run qa:browser:local -- <config>` uses an installed Chrome/Chromium through the DevTools Protocol. Set `BROWSER_EXECUTABLE` only when browser auto-discovery is insufficient.
- `npm run qa:browser:managed -- <config>` uses Steel when `STEEL_API_KEY` is already available.

Shared assertions live in `qa/browser-qa-core.mjs`. Both paths emit JSON evidence and screenshots under `artifacts/browser-qa/` by default.

Required P3 coverage:
- PC and SP/mobile responsive checks
- navigation / critical route checks
- console and runtime errors
- screenshots / visual evidence with SHA-256
- regression verification through baseline title, selector, document-width, and screenshot-hash checks

Deterministic verification:
- `npm run qa:p3:contract` validates assertion and regression logic without starting a browser.
- `npm run qa:p3:chromium` runs a real PC/SP Chrome/Chromium fixture and proves viewport emulation, DOM checks, runtime cleanliness, and screenshot evidence.

## Deployment policy

Vercel operations follow:

**GitHub development branch update → Preview → DEV ROOM → automated Visual QA → NORIZO confirmation → Production**

Preview is the normal shared development surface. Production remains blocked until explicit NORIZO approval. See `docs/PREVIEW_FIRST_WORKFLOW.md`.

## Security and cost

- Never commit secrets or tokens.
- Keep browser viewer/debug URLs private.
- Prefer the local Chromium path when it is sufficient.
- Start paid browser sessions only when needed and stop them promptly.
- Prefer structured APIs over browser automation for data collection.
- Do not add a paid service or material new spend without explicit approval.
