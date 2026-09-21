# DEV ROOM maintenance evidence — CNW route drift

Observed: 2026-09-21T15:17:30Z (2026-09-22 JST)

## Foundation status

P1-P5 remain complete and DEV ROOM remains in maintenance mode. This run did not inspect, start, rebuild, or recreate ConoHa. It did not request a Vercel Preview and did not deploy Production.

## GitHub / source observations

- `NORIZO0201/norizo-dev-room` remains the canonical DEV ROOM repository.
- `NORIZO0201/craft-nihon-wine` production was promoted after the previous P5 handoff by a one-shot release commit (`24336a8fd84c5d64a1fbfb0ca47831eecb4f5eef`), then the repository restored its review-only deployment gate (`eceaaebbec8e995cc5ece296a025b57317881340`).
- CNW main was repaired without deployment:
  - `9c5eb56d330e422be60bac53e793fa3787a257c0` removes pre-encoding from Favorites wine `<Link>` routes.
  - `0180a8c2cf82f60b6bb511a5c40ce2a118126f48` stores the Favorite item URL as the raw Unicode wine route.
  - `a428d294ac44783d2673aac9eede4b0e3e413caa` rejects malformed `%25` wine paths with a deterministic 404 before they can reach the dynamic-route decoder.
- CNW `vercel.json` keeps automatic deployment disabled for `main`; these maintenance commits therefore remain source-only until NORIZO explicitly approves a Production promotion.

## Supabase / OMNW boundary observations

All four observed Supabase projects were `ACTIVE_HEALTHY`: SAYAKA, CNW, OMNW, and NIHON WINE.JP.

The read-only OMNW P2 audit remains clean:

- Harvest-named database surfaces: `0`.
- Expected Discovery/Master/Consumer ownership tables: present.
- Consumer foreign keys directly into Discovery tables: `0`.
- Active OMNW Edge Functions contain no Harvest-named function.
- Consumer branch `agent/recognition-core-m0-m4` still exists.

The retired OMNW Harvest pipeline remains absent and was not revived.

## Vercel observations

- DEV ROOM: no runtime errors in the observed previous hour.
- SAYAKA: no runtime errors in the observed previous hour.
- OMNW: no runtime errors in the observed previous hour.
- NIHON WINE.JP: no runtime errors in the observed previous hour.
- CNW: the newer Production deployment `dpl_DDYosa76kNfAaKXJSKR7aoqjBzrc` is READY at source commit `24336a8fd84c5d64a1fbfb0ca47831eecb4f5eef`, but Production still logged four `failed to decode param` 500 requests on `/wines/[slug]` around 2026-09-21T15:01Z. The malformed request contains `%25` inside a long Japanese wine slug.
- Two READY non-Production deployments for branch `chatty/cnw-malformed-wine-url-guard-20260921` were observed as external/concurrent evidence. This maintenance run did not create or open either deployment.
- No deployment was created for the three CNW main maintenance commits above.

## Handoff

DEV ROOM foundation remains PASS. CNW remains a PASS development gate with a separate Production boundary: source remediation is ahead of Production, and Production promotion remains prohibited until explicit NORIZO approval. Future maintenance runs should re-check CNW Production runtime errors and keep the source/production boundary explicit.
