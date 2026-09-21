# PC/SP Browser QA Base

Updated: 2026-09-21 JST

## Decision

DEV ROOM browser QA is **provider-neutral and VPS-free**.

Use an already-available managed browser/provider path (Steel Cloud when configured, or another reachable Playwright-compatible provider already approved for the project). Do not create or self-host Steel on ConoHa or any replacement VPS merely to satisfy P3.

## Required QA profiles

### PC
- default target viewport: 1440 × 900 unless the project specifies another canonical desktop size
- desktop navigation and interaction checks
- runtime/console error capture
- screenshot/evidence capture

### SP
- canonical project mobile viewport (393 × 852 when no project-specific size is defined)
- touch/mobile interaction checks
- responsive overflow/layout checks
- runtime/console error capture
- screenshot/evidence capture

## Required evidence per run

A reusable QA run records:
- project / route
- tested URL
- viewport/profile
- navigation result
- key DOM/assertion result
- console/runtime errors
- screenshot/evidence reference
- regression PASS/FAIL outcome

## Operating flow

1. Chatty selects the project, route set, and QA objective.
2. Use the configured managed/reachable browser provider only for the required test window.
3. Run PC and/or SP checks.
4. Capture deterministic evidence.
5. Stop/release the browser session.
6. Persist regression outcome into the P1–P5 evidence/handoff state.
7. Create a Vercel Preview only when NORIZO explicitly asks to see it.
8. Deploy Production only after the required checks and explicit approval.

## Cost and security

- Prefer structured APIs over browser automation for data collection.
- Keep sessions on-demand; do not leave paid browser sessions idling.
- Keep viewer/debug URLs private.
- Never commit browser provider tokens.
- Do not add a new paid browser service without explicit approval.
