# DEV ROOM maintenance evidence — deterministic maintenance gate

Observed: 2026-09-21T16:10:00Z (2026-09-22 JST)

## Foundation result

P1–P5 remain **COMPLETE** and the DEV ROOM foundation remains **PASS** in maintenance mode.

This run did not inspect, start, rebuild, or recreate ConoHa. It did not create a Vercel Preview and did not deploy Production.

## Deterministic maintenance gate added

The maintenance state is now machine-checkable rather than documentation-only:

- Contract: `contracts/maintenance-mode.json`
- Observation checkpoint: `state/MAINTENANCE_OBSERVATION.json`
- Validator: `scripts/validate-maintenance-state.mjs`
- Negative self-test: `qa/maintenance-selftest.mjs`
- Command: `npm run qa:maintenance`

The validator checks that P1–P5 remain complete, maintenance mode remains active, ConoHa remains retired, Preview/Production approval boundaries remain intact, tracked GitHub/Supabase/Vercel evidence exists, and the OMNW retired-Harvest / Discovery-Consumer boundary remains clean.

The validator and negative self-test were executed in the automation workspace and both returned PASS.

## DEV ROOM deployment boundary hardened

Official Vercel configuration supports `git.deploymentEnabled: false` to disable automatic Git deployments. DEV ROOM now uses that setting in `vercel.json`.

After the maintenance commits were pushed, Vercel reported no new DEV ROOM deployment in the observed window. The existing protected Production deployment remains unchanged and healthy, with zero runtime errors in the latest one-hour observation.

## GitHub observations

- DEV ROOM remains the canonical control repository.
- SAYAKA main: `c0e087f2cc1cf74cd9e0b30ff51c37f9d7eb7bf8`.
- CNW main advanced to `1140ccf60b676c7c10acd95dd9107bbe24776f69`; Production remains on `24336a8fd84c5d64a1fbfb0ca47831eecb4f5eef`, so source remains ahead of Production.
- OMNW main remains `1a926caace6fe12621966a52e9593f6f721c68ba`.
- OMNW Consumer branch `agent/recognition-core-m0-m4` advanced to observed M3 SHA `fef80993180dbb7e48e44fe5d009b9d9a740dfa4`.
- NIHON WINE.JP main remains `c235c76d03ed505899ac4cb9f93f5ed4dd50c19f`.

## Supabase / OMNW boundary observations

All tracked Supabase projects are `ACTIVE_HEALTHY`: SAYAKA, CNW, OMNW, and NIHON WINE.JP.

The read-only OMNW boundary audit returned:

- Harvest-named database surfaces: `0`.
- Consumer foreign keys directly into Discovery tables: `0`.
- `recognition_image_index`: present.

The retired Harvest pipeline remains absent. Consumer Recognition work remains isolated from Discovery/Master source data.

## Vercel observations

Latest one-hour runtime error count:

- DEV ROOM: `0`
- SAYAKA: `0`
- CNW: `0`
- OMNW: `0`
- NIHON WINE.JP: `0`

CNW has newer non-Production branch deployments associated with concurrent winery-owner-page work. They were observed but were not created by this maintenance run. CNW Production remains unchanged and still requires explicit NORIZO approval for any promotion.

OMNW Consumer branch deployment attempts observed in this window are canceled by the current branch policy; no Consumer branch deployment was promoted.

## Public evidence

The NIHON WINE.JP public homepage was reachable during this run and displayed current news dated 2026-09-21. Generic public fetches for some other domains were unavailable through the observation path, so those projects used direct Vercel deployment/runtime evidence instead of treating a fetch limitation as a site failure.

## Known approval boundary

OMNW main currently uses an `ignoreCommand` configuration that allows `main` builds while ignoring non-main branches. Changing that on OMNW main could itself enter the Production deployment path. This maintenance run therefore did not modify OMNW main. Any hardening of that specific Production trigger remains behind the explicit NORIZO Production-approval boundary.

## Result

The DEV ROOM P1–P5 foundation remains complete. Maintenance now has an explicit contract, reproducible checkpoint, deterministic validator, negative self-test, and a no-auto-Git-deploy guard on DEV ROOM itself. Future runs can resume idempotently from `state/MAINTENANCE_OBSERVATION.json` and only repair newly observed drift.
