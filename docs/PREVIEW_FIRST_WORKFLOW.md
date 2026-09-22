# NORIZO LAB Preview-First Development Workflow

Updated: 2026-09-22 JST

## Canonical flow

GitHub development branch update
→ Preview deployment
→ DEV ROOM preview registry update
→ automated Visual QA against the rendered Preview
→ NORIZO visual confirmation
→ Production only after explicit NORIZO approval

## Rules

1. Preview is the shared development surface, not a release approval boundary.
2. Development branches should create/update Preview deployments automatically when supported by the hosting platform.
3. Production branches must not auto-deploy.
4. DEV ROOM must display both Production URL and latest Preview URL for each service.
5. Automated browser/Visual QA must target the latest READY Preview when one exists.
6. Visual QA judges the rendered page, not DOM/CSS declarations alone.
7. A failed Visual QA loops back to fix → rebuild → Preview → re-render → re-check.
8. Production promotion requires explicit NORIZO approval after Preview, deterministic checks, and Visual QA pass.
9. GitHub Actions are not used as an AI orchestration or deployment command bus.
10. Cost is monitored, but Preview is intentionally used as the normal development surface.

## Platform mapping

- Vercel services: development branch → Vercel Preview.
- Shopify/CWS: development theme/Theme Preview plays the same Preview role.
- Any future hosting platform must provide an equivalent non-production preview/staging surface before Production.

## Current services

OMNW, NIHON WINE.JP, CNW, DIS, SAYAKA KITCHEN, 日本チーズ.jp, CSLS/cws-order-form, VDOR, DEV ROOM, and CWS Shopify theme.

Production remains protected for every service.
