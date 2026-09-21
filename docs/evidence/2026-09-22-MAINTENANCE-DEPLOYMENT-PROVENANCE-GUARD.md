# DEV ROOM maintenance — deployment provenance guard

Observed: 2026-09-21T19:08:53Z (2026-09-22 JST)

## Foundation

P1-P5 remain complete. This run did not inspect, start, rebuild, or recreate ConoHa. No Vercel Preview or Production deployment was created by this DEV ROOM run.

## Fresh evidence

- SAYAKA GitHub main: `c0e087f2cc1cf74cd9e0b30ff51c37f9d7eb7bf8`; Supabase `ACTIVE_HEALTHY`; Vercel runtime errors in the latest 1h: 0.
- CNW GitHub main: `98d40a13f1a3beab1fd2e8e49979650a9d11b562`; Supabase `ACTIVE_HEALTHY`; current Production remains `dpl_DDYosa76kNfAaKXJSKR7aoqjBzrc` / `24336a8fd84c5d64a1fbfb0ca47831eecb4f5eef`.
- CNW Production emitted 4 error-level runtime logs with HTTP 500 in the latest 1h, all on `/wines/[slug]`, from malformed percent-encoded wine paths. Current main is 18 commits ahead of Production and includes later malformed-path guards in `proxy.ts` and `app/wines/[slug]/page.tsx`. No Production promotion was performed.
- OMNW GitHub main advanced from `1a926caace6fe12621966a52e9593f6f721c68ba` to `72e0582c4a9c9894af10f471ffc1f173d24a3601`, a squash containing Recognition Core M0-M4.
- Vercel created OMNW Production deployment `dpl_77tfhLbeCkDs2MoXx4yTXkxWP3cV` for that main SHA. This DEV ROOM run did not create it, and the canonical state contains no explicit NORIZO approval provenance for this Production change. It is therefore recorded as `UNVERIFIED_EXTERNAL_CHANGE`, not silently accepted as an approved baseline.
- OMNW Vercel runtime errors in the latest 1h: 0.
- OMNW Supabase remains `ACTIVE_HEALTHY`; retired Harvest tables/views: 0; retired Harvest edge functions: 0; Consumer -> Discovery direct foreign keys: 0; `recognition_image_index` exists.
- NIHON WINE.JP GitHub main remains `c235c76d03ed505899ac4cb9f93f5ed4dd50c19f`; Supabase `ACTIVE_HEALTHY`; Vercel runtime errors in the latest 1h: 0. Public homepage observation succeeded and still shows NEWS dated 2026-09-21.

## Deterministic improvement

The previous maintenance gate only proved that *this run* did not create Preview/Production deployments. It could not represent a deployment created by another actor between runs. Maintenance now records deployment provenance events and requires every unverified external deployment to force `BLOCKED_HUMAN_CONFIRMATION` instead of a false all-clear.

The validator/self-test now guard this invariant:

1. every observed external deployment event identifies project, environment, deployment ID, SHA, and authorization provenance;
2. `UNVERIFIED_EXTERNAL_CHANGE` cannot coexist with maintenance gate `PASS`;
3. a blocked maintenance gate must carry an explicit blocker entry;
4. P1-P5 foundation completion remains independent and stays `PASS`.

The old CI path that syntax-checked VPS/systemd deployment artifacts was replaced by `DEV ROOM foundation QA`. GitHub Actions run `35643970546` on `205bf63ca043670b661ebc217281607febf2f454` completed `success`; its P1-P5 canonical state, P3 contract, P4 worker contract, P5 gates, maintenance gate, and retired-infrastructure policy steps all passed.

The remaining executable VPS entrypoints were also hard-disabled without contacting any VPS:

- `deploy/health/install-health-monitor.sh` now exits `78` before any `systemctl`/network action.
- `deploy/workers/install-omnw-resident-workers.sh` now exits `78` before any service installation/start.
- `scripts/write-baseline.py` is now a retired tombstone and no longer inspects host services, Docker, repositories, or systemd.
- The foundation workflow asserts those retirement markers and rejects reintroduction of `systemctl`/`subprocess` behavior in those entrypoints.

## Vercel policy note

Vercel's official project configuration supports `git.deploymentEnabled: false` to prevent automatic Git deployments. OMNW currently uses an `ignoreCommand` that allows `main`, so a main merge can create Production automatically. Changing OMNW's Production-branch configuration is intentionally not performed here because the canonical rule requires explicit NORIZO approval for Production-affecting operations.

## Human boundary

Two Production decisions remain outside automation:

- confirm whether OMNW `dpl_77tfhLbeCkDs2MoXx4yTXkxWP3cV` / `72e0582...` should be accepted as the approved current Production baseline, and separately authorize any hardening that disables automatic main deployment;
- CNW current Production has fresh 500s on malformed wine URLs while later fixes are source-ahead. Promotion remains prohibited until NORIZO explicitly approves it.
