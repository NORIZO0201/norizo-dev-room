# Maintenance Evidence — OMNW Consumer M4

Date: 2026-09-22 JST  
Mode: NORIZO DEV ROOM maintenance  
Foundation: P1–P5 COMPLETE

## Result

**PASS — OMNW Consumer Recognition Core has reached M4 while the P2 Discovery/Master ↔ Consumer boundary remains intact.**

This maintenance pass also hardened the deterministic maintenance gate so the persisted OMNW Consumer milestone can no longer silently regress from M4 to an older checkpoint.

## GitHub evidence

- OMNW canonical main: `NORIZO0201/oh-my-nihon-wine@1a926caace6fe12621966a52e9593f6f721c68ba`
- Isolated Consumer branch: `agent/recognition-core-m0-m4`
- Observed Consumer branch head: `a6911de80df7f7851562b741580cc91f9a61c4b7`
- Commit message: `M4: enrich recognized wines and related references`
- The M4 diff adds post-identification enrichment and related-reference reads while keeping identity resolution anchored to OMNW canonical data.

## Supabase boundary audit

Project: `omnw-production` (`alqnnnkuvdpxkqxdqted`)

Read-only audit result:

- Harvest-named table/view surfaces: `0`
- Consumer → Discovery direct foreign keys: `0`
- `recognition_image_index`: present
- Discovery/Master ownership tables remain present independently of Consumer tables.

Therefore:

- retired Harvest remains absent;
- Consumer does not directly depend on Discovery tables through foreign keys;
- Consumer-side recognition learning remains available through the recognition sidecar surface rather than by mutating Discovery/Master ownership data.

## Vercel evidence

- OMNW Production runtime errors in the latest one-hour observation: `0`
- M4 branch deployment attempt: `dpl_FABnEfS8VAw33pWHUhQVG5PHSuAK`
- M4 branch deployment state: `CANCELED`
- No Preview or Production deployment was created by this DEV ROOM maintenance run.

CNW remains on Production SHA `24336a8fd84c5d64a1fbfb0ca47831eecb4f5eef` while source has advanced to `c7a7d7289cf4c418856990349d50fb66033eaab2`; Production promotion remains an explicit NORIZO approval boundary.

## Cross-project health evidence

Fresh Supabase project inventory reported the tracked production projects as `ACTIVE_HEALTHY`:

- SAYAKA KITCHEN
- Craft Nihon Wine
- OMNW
- NIHON WINE.JP

Fresh Vercel production runtime-error observation for the same tracked surfaces reported no error/fatal entries in the latest one-hour window.

## Public evidence

`https://nihonwine.jp/` was directly observable and showed NEWS dated `2026-09-21`.

The generic public fetch path could not directly retrieve `craft-nihon-wine.jp` or `sayaka-kitchen.com` in this pass, so their current health evidence comes from Vercel deployment/runtime observation rather than an invented public-browser success claim.

## Deterministic repair made in this pass

The maintenance contract now requires `omnw_consumer_milestone: M4`. The validator reads that requirement from the contract instead of hard-coding the previous M3 checkpoint. The maintenance self-test now intentionally downgrades the observed milestone to M3 and requires the validator to reject that state.

This makes future hourly maintenance idempotent: M4 is the persisted Consumer baseline, while Discovery/Master separation, retired-Harvest absence, approval boundaries, and low-cost operation remain mandatory.

## Prohibited actions preserved

- ConoHa was not checked, started, recreated, or used.
- The old OMNW Harvest pipeline was not revived.
- No Vercel Preview was created by this run.
- No Production deployment was created by this run.
