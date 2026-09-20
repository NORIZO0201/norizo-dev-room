# NORIZO DEV ROOM V3

Cloud browser control room for shared PC/SP QA.

## Current capabilities
- Steel PC 1440x900 + true mobile fingerprint sessions
- Human-interactive live viewers
- Project presets and one-click dual navigation
- Optional PC→SP / SP→PC URL linking
- Lightweight dual QA inspection
- Automatic session renewal before the 15 minute hobby-plan limit
- Steel Profiles enabled to preserve browser state across renewals where possible

## Vercel env
- `STEEL_API_KEY` (required)

## Security note
Steel debug URLs are bearer-style live access URLs. Keep this application private. Add Vercel Deployment Protection or an app-level access secret before wider sharing.
