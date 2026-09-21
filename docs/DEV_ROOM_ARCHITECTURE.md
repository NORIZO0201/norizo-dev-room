# NORIZO DEV ROOM Architecture

Updated: 2026-09-21 JST

## Purpose

DEV ROOM is NORIZO LAB's development and operations foundation for PC/SP work, browser QA, OMNW, RELIS, SAYAKA, CNW, and other projects.

Chatty is the command origin. DEV ROOM provides canonical phase state, deterministic checks, browser QA, observation contracts, and handoff evidence. It is not an AI-to-AI coordination system and has no VPS dependency.

## Roles

| Component | Role |
| --- | --- |
| NORIZO | Owner / final approval for Production and other high-risk decisions |
| ChatGPT / Chatty | Single normal command origin, planning, QA, direct service operations |
| GitHub | Code, docs, diffs, phase state, history, audit only |
| Supabase | Project data/backends where required |
| Vercel | App hosting; Preview only on explicit request; Production only after approval |
| Managed browser/provider tooling | PC/SP browser development and QA |
| Shopify | CWS commerce system |
| Claude Code / Codex / Gemini | Optional bounded specialist tools only |

## Architecture

```text
NORIZO
   ↓
ChatGPT / Chatty
   ├─ GitHub
   │    ├─ code / docs
   │    ├─ state/DEV_ROOM_STATE.json
   │    └─ docs/evidence/
   ├─ Supabase
   ├─ managed browser/provider tooling
   ├─ Vercel
   └─ Shopify / project APIs
```

ConoHa/VPS is intentionally absent. DEV ROOM phases P1–P5 must remain usable without it.

## P1–P5 contracts

### P1 — Control Room / health / canonical state
- Canonical state is machine-readable and versioned.
- Health means repository state, connected-service state, and deterministic checks; it does not mean a resident VPS daemon.
- Completion evidence is persisted and resumable.

### P2 — OMNW separation
- Discovery/Master are backend/data-engine concerns.
- Consumer development is a separate surface and must not mutate Discovery data merely to support UI development.
- The retired Harvest pipeline must remain absent.

### P3 — Browser QA
The reusable QA gate must cover:
- PC and SP/mobile viewport checks
- navigation / critical route checks
- console/runtime errors
- screenshots or equivalent visual evidence
- regression re-checks

Use already-available managed browser/provider tooling. Do not introduce a VPS dependency.

### P4 — Reusable project observation
RELIS and similar projects reuse the same checkpoint / heartbeat / observation vocabulary. The contract is provider-neutral and must not assume systemd, a fixed host, or ConoHa.

### P5 — Deterministic QA/batch handoff
SAYAKA, CNW, OMNW, and other projects receive deterministic gates with explicit PASS / FAIL / PASS-NOT-REQUIRED outcomes plus handoff evidence.

## Device runtime (iPhone / Android / PC panes)

The DEV ROOM device frames are **streamed snapshots of a remote browser session**, not embedded third-party emulators. One session exists per visible device.

| Device | Viewport | Presentation | Interaction |
| --- | --- | --- | --- |
| iPhone | 393 × 852, dpr 3, Mobile Safari UA | PNG snapshot polled into the device frame | click → remote touch tap, wheel/drag → remote scroll |
| Android | 412 × 915, dpr 2.625, Mobile Chrome UA | PNG snapshot polled into the device frame | click → remote touch tap, wheel/drag → remote scroll |
| PC | 1440 × 900 | provider live/debug viewer in an iframe | direct, inside the viewer |

Two rules keep this working, and breaking either one silently degrades a mobile pane to a desktop screenshot:

1. **The device belongs to the session, not to a CDP override.** `createSession()` sets the provider's own `dimensions` and `userAgent` for the target device. Chrome reverts every `Emulation.*` override when the CDP client that set it detaches, so an override alone is never a durable device profile.
2. **One connection per session, reused.** `api/providers/_browser.mjs` pools the CDP connection inside the function instance, applies emulation once on connect, and re-asserts it if the viewport ever drifts. Connecting and disconnecting per operation both discards the emulation and adds a multi-second handshake to every snapshot.

Snapshots are captured at CSS scale, so a snapshot PNG is exactly viewport-sized. The browser keeps one snapshot request in flight per device and maps clicks through the real drawn image rectangle, which is what makes tap coordinates correct despite the `object-fit: contain` letterbox inside the device shell.

`npm run qa:devroom:runtime` exercises this whole path — start, snapshot, tap, scroll, navigate, inspect, stop — against local Chromium, with no provider key and no Preview deploy.

## GitHub policy

GitHub is not a command bus.

Do not restore:
- `@claude` dispatch
- `@codex` dispatch
- Gemini PR review automation
- GitHub Actions that invoke AI agents
- resident services that poll GitHub for natural-language instructions

## Deployment

Vercel:

Local/tooling QA → Preview only when NORIZO asks → NORIZO confirmation → Production.

## Safety

High-risk, Production, destructive, paid, DNS, or secret/key operations require NORIZO approval. ConoHa must not be inspected, started, rebuilt, or recreated.
