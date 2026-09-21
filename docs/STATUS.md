# STATUS — NORIZO DEV ROOM

Updated: 2026-09-22 JST

## Current status

**P1 complete / P2 complete / P3 complete / P4 complete / P5 complete.**

The P1→P5 development foundation is complete and DEV ROOM is now in **maintenance mode**.

Canonical machine-readable state: `state/DEV_ROOM_STATE.json`  
P5 handoff: `state/P5_HANDOFF.json`  
Maintenance checkpoint: `state/MAINTENANCE_OBSERVATION.json`  
Maintenance contract: `contracts/maintenance-mode.json`  
Completion and maintenance evidence: `docs/evidence/`

## Current operating model

NORIZO LAB is **Chatty-first**.

- NORIZO → ChatGPT / Chatty is the only normal command origin.
- GitHub is code/document/history/checkpoint/audit storage only.
- GitHub Issues, PR comments, mentions, labels, and Actions are not an AI-dispatch mechanism.
- Claude Code, Codex, and Gemini are optional bounded tools, not standing execution owners.
- ConoHa is retired and is not part of the operating architecture.
- No autonomous AI-to-AI relay is part of the production operating model.

## P1–P5 foundation

1. **P1 — Control Room / health / canonical state — COMPLETE**
2. **P2 — OMNW Discovery/Master + Consumer development support — COMPLETE**
3. **P3 — reusable PC/SP browser QA gate — COMPLETE**
4. **P4 — reusable worker/observation contracts for RELIS and similar projects — COMPLETE**
5. **P5 — deterministic project batch/QA gates + handoff state — COMPLETE**

P5 completion evidence: `docs/evidence/2026-09-21-P5-COMPLETE.md`.  
Latest maintenance evidence: `docs/evidence/2026-09-22-MAINTENANCE-OMNW-M4.md`.

## Infrastructure direction

### GitHub

Keep repositories, code, documents, diffs, phase state and audit history.  
Do not use GitHub as an AI command bus.

### Supabase

Use project databases/backends through explicit schemas and deterministic service boundaries. OMNW Discovery/Master data remains separate from Consumer-facing development state.

### Browser QA

Use managed browser/provider APIs or already-available browser tooling. No VPS is required for PC/SP responsive checks, navigation, runtime/console inspection, screenshots, or regression evidence.

### Vercel

Local/tooling QA → Preview only when NORIZO asks → NORIZO confirmation → Production only with explicit NORIZO approval.

DEV ROOM itself has automatic Git deployment disabled through `git.deploymentEnabled: false`, so maintenance-state commits do not create an implicit Preview or Production deployment.

## P5 handoff note

`state/P5_HANDOFF.json` records `foundation_status: PASS`.

- SAYAKA: P5 gate PASS; Supabase healthy and no runtime errors observed in the latest one-hour window.
- CNW: P5 development gate PASS. Production remains on `24336a8fd84c5d64a1fbfb0ca47831eecb4f5eef`, while source has advanced to `c7a7d7289cf4c418856990349d50fb66033eaab2`. No runtime errors were observed in the latest one-hour window, but source remains ahead of Production and any promotion remains blocked pending explicit NORIZO approval.
- OMNW: P5 gate PASS; Discovery/Master and Consumer remain separate; retired Harvest remains absent. The isolated Consumer branch has reached **M4** at `a6911de80df7f7851562b741580cc91f9a61c4b7`; the M4 deployment attempt was canceled by policy and the recognition sidecar remains separated from Discovery/Master source data.
- NIHON WINE.JP: `PASS-NOT-REQUIRED`; no runtime errors were observed in the latest one-hour window. Historical WordPress proxy observations remain project-specific and do not block the DEV ROOM foundation.

No Preview or Production deployment is implied by P5 completion or maintenance repair.

## Deterministic maintenance gate

Run `npm run qa:maintenance` to validate the persisted maintenance checkpoint.

The gate checks:

- P1–P5 remain complete and maintenance mode remains active;
- ConoHa remains retired and untouched;
- Preview and Production approval boundaries remain intact;
- tracked GitHub main SHAs, Supabase health and Vercel runtime evidence are present;
- OMNW retired Harvest surfaces remain absent;
- OMNW Consumer remains separated from Discovery/Master;
- OMNW Consumer milestone remains at the contract-required M4 checkpoint;
- the persisted public-evidence checkpoint remains present.

The gate includes a negative self-test that intentionally downgrades OMNW from M4 to M3 and requires validation to fail, alongside the existing retirement, health, and deployment-boundary guards.

## Maintenance mode

DEV ROOM remains enabled after P5 and must continue to:

- preserve the P1–P5 contracts and canonical phase state;
- detect foundation drift and make safe deterministic repairs when possible;
- refresh `state/MAINTENANCE_OBSERVATION.json` with exact evidence;
- run the deterministic maintenance gate after state changes;
- preserve the OMNW Discovery/Master ↔ Consumer boundary;
- never revive the old OMNW Harvest pipeline;
- keep P3 browser QA reusable for PC/SP verification;
- keep P4 checkpoint/heartbeat conventions reusable by RELIS and other projects;
- observe GitHub/Supabase/Vercel on the existing allowlist at low cost;
- never check, start, rebuild, or recreate ConoHa;
- never create Vercel Preview unless NORIZO explicitly asks to see one;
- never deploy Production without explicit NORIZO approval.

Maintenance continues until NORIZO explicitly stops it.

## Known approval boundary

OMNW main currently uses a Vercel `ignoreCommand` that allows `main` builds while ignoring non-main branches. A change to that file on OMNW main could itself enter the Production deployment path, so maintenance must not alter it without explicit NORIZO Production approval. Consumer branch deployment attempts remain canceled under the current branch policy.

## Retired on 2026-09-21

- ConoHa / VPS dependency for DEV ROOM
- ConoHa MCP configuration
- ConoHa provisioning/setup path
- GitHub → Claude Code dispatch
- GitHub → Codex dispatch
- GitHub → Gemini dispatch
- Claude resident orchestrator
- GitHub Actions as AI handoff infrastructure
- AI TEAM v1 / three-agent coordination model
- autonomous AI-to-AI P0→P5 rollout model

Historical git history remains the audit record. These mechanisms must not be restored without a new explicit NORIZO decision.
