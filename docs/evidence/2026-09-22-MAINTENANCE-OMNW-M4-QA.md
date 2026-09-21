# DEV ROOM maintenance evidence — OMNW Consumer M4 QA hardening

Observed at: 2026-09-21T18:10:00Z (2026-09-22 03:10 JST)

## Foundation state

- P1-P5 remain COMPLETE.
- DEV ROOM remains in maintenance mode.
- ConoHa was not checked, started, rebuilt, or recreated.
- No Vercel Preview or Production deployment was created by this DEV ROOM maintenance run.

## OMNW Consumer M4

- Repository: `NORIZO0201/oh-my-nihon-wine`
- Canonical main: `1a926caace6fe12621966a52e9593f6f721c68ba`
- Consumer branch: `agent/recognition-core-m0-m4`
- Consumer branch HEAD: `6d9cfa6466e817e5d0c8c2eaa26e0ec6b8cf4cfd`
- Milestone: M4
- GitHub Actions workflow: `Recognition Core QA`
- Workflow run: `35630485168`
- Result: PASS
- Passing checks observed: install, typecheck, project QA, Python compile, scoped ESLint including M4 QA, and build.
- Vercel branch attempt `dpl_8awgcVYesUmfRUQbBrEzxboBMnGJ` was CANCELED by the existing ignored-build policy; no Consumer Preview/Production promotion occurred.

## OMNW boundary audit

Fresh read-only Supabase evidence:

- Harvest tables/views: 0
- Harvest edge functions: 0
- Consumer → Discovery direct foreign keys: 0
- `recognition_image_index`: present
- Discovery/Master and Consumer remain separate.

The retired Harvest pipeline remains absent and was not revived.

## Deterministic maintenance improvement

The maintenance contract now requires explicit passing OMNW Consumer QA evidence in addition to an M4 branch SHA. The maintenance validator requires `consumer_qa_status = PASS` and a positive GitHub Actions workflow run ID. The maintenance self-test deliberately regresses the Consumer QA state to FAIL and requires the validator to reject it.

This closes a previous gap where an M4-labelled Consumer branch could have been accepted even if its current deterministic QA was broken.

## Cross-project observation

- SAYAKA Supabase: ACTIVE_HEALTHY; Vercel runtime errors in the observed one-hour window: 0.
- OMNW Supabase: ACTIVE_HEALTHY; Vercel runtime errors: 0.
- NIHON WINE.JP Supabase: ACTIVE_HEALTHY; Vercel runtime errors: 0; public homepage observed.
- CNW Supabase: ACTIVE_HEALTHY; existing Production still serves HTTP 200, but Vercel telemetry recorded five repeated caught `fetch failed` / `write ETIMEDOUT` entries on one `/wines/[slug]` request at 2026-09-21T17:17:05Z. Production was not changed.

CNW source remains ahead of the existing Production SHA. Production promotion remains blocked until explicit NORIZO approval.
