# DEV ROOM native mobile host integration — implemented, host dependency unresolved

Date: 2026-09-25
Order IDs: `dev-devroom-native-mobile-20260926-01` (#29), `dev-devroom-native-mobile-20260926-02` (#30)
Continues: issue #28
Result: **integration implemented and tested; Actual State for both native devices is OFFLINE pending a real host**

## Goal (from #28/#29/#30)

Replace the Appetize/small-desktop-browser mobile display as DEV ROOM's canonical
mobile path with real device rendering:

- PC = Desktop Chrome (unchanged)
- iPhone = Apple iOS Simulator + Mobile Safari
- Android = Android Emulator (Pixel profile) + Chrome for Android

Viewport/User-Agent emulation must never be reported as native.

## What was audited

- `api/start.mjs` / `api/navigate.mjs` previously treated Appetize (a hosted
  device-cloud embed, itself a real device farm but not one DEV ROOM
  controls or can label as "our native host") as the only iPhone/Android
  path, and `api/providers/playwright-local.mjs` created a desktop Chromium
  context with `isMobile: true` and a 390×844 viewport for a "mobile"
  session — genuine viewport/User-Agent emulation, not a native runtime.
- Neither path runs inside an actual Apple iOS Simulator or Android Emulator
  under DEV ROOM's control, and neither exposed an Actual State contract
  (NATIVE LIVE / OFFLINE / ERROR, device/runtime, URL, last navigation
  result, evidence freshness) as required by #28's acceptance criteria.

## What was implemented

- `api/native-host-core.mjs` — framework-free contract: env-key resolution
  per device kind (`NATIVE_IOS_HOST_URL`/`NATIVE_ANDROID_HOST_URL` +
  tokens), a URL allowlist/SSRF guard (`validateTargetUrl`), exact argv
  builders for `xcrun simctl openurl` and `adb shell am start`
  (`buildIosSimulatorLaunch`, `buildAndroidChromeLaunch`), the Actual State
  computation (`computeActualState`, never reports `NATIVE_LIVE` without a
  fresh host probe), and bounded recovery (`withBoundedRetry`, capped
  attempts with exponential backoff — no infinite retry loop against a
  stale simulator/emulator).
- `api/providers/native-host.mjs` — the Vercel-side HTTP client that calls
  a real host agent's `/health` and `/navigate` endpoints with a bounded
  timeout and bounded retry; reports `OFFLINE` with the exact missing env
  var when no host is configured, `ERROR` with the underlying reason when a
  configured host is unreachable, and only `NATIVE_LIVE` on a fresh
  successful probe.
- `api/native-state.mjs` — new Actual State endpoint (`GET/POST
  /api/native-state`) surfacing `{device, state, runtime, url,
  lastNavigationResult, evidenceFreshnessMs, missingDependency}` per
  device, kept separate from `/api/inspect` (which stays Appetize/Steel's
  own VISUAL/PASS contract) so native state is never conflated with
  emulation.
- `api/navigate.mjs` — a URL change ("Go") now also forwards to a
  configured native host, best-effort and non-blocking, so a DEV ROOM URL
  change reaches the native browser path when a host exists; the
  Appetize/PC response is unaffected when no native host is configured.
- `scripts/native-host-agent/ios-agent.mjs` and `android-agent.mjs` — the
  other end of the protocol, meant to run on the real host machines: the
  iOS agent drives `xcrun simctl` against a booted Simulator UDID, the
  Android agent drives `adb` against a booted AVD serial. Both import the
  same command builders from `api/native-host-core.mjs`, so the exact
  command run on the host is covered by the same unit tests without
  needing `xcrun`/`adb` installed in this environment. See
  `scripts/native-host-agent/README.md`.
- `index.html` / `devroom-v7.js` — a new "NATIVE MOBILE (実機ランタイム)"
  panel polls `/api/native-state` every 15s and after every navigation,
  showing `NATIVE LIVE` / `OFFLINE` / `ERROR` per device plus
  runtime/URL/last-navigation-result/evidence-freshness, explicitly
  distinct from and never overwriting the existing Appetize/PC panes.
- `qa/native-host-selftest.mjs` (`npm run qa:native-host`) — regression
  tests for: exact-missing-dependency reporting, URL scheme allowlisting,
  SSRF/private-host blocking, exact iOS/Android command construction,
  Actual State never reporting `NATIVE_LIVE` without a fresh probe,
  evidence-freshness computation, and bounded-retry attempt capping and
  recovery.

## Executed and verified in this environment

```
$ npm run qa:native-host
{ "ok": true, "contract": "api/native-host-core.mjs", "checks": [ ... 11 checks ... ] }

$ node -e "getActualState('iphone', {}) / getActualState('android', {})"
{
  "iphone": { "state": "OFFLINE", "missingDependency": "NATIVE_IOS_HOST_URL", ... },
  "android": { "state": "OFFLINE", "missingDependency": "NATIVE_ANDROID_HOST_URL", ... }
}

$ npm run qa:state   # unaffected — still ok:true, P1-P5 complete
$ npm run qa:p3:contract   # unaffected — existing PC/SP viewport gate still passes
```

## Actual State (required before COMPLETE)

| Device  | Actual State | Detail |
| --- | --- | --- |
| PC | preserved | Existing Steel/Playwright desktop path unchanged; not touched by this change. |
| iPhone | **OFFLINE** | Missing dependency: `NATIVE_IOS_HOST_URL`. No macOS host running Xcode/`xcrun simctl` is reachable from Vercel serverless functions or from this Linux cloud development container — Apple's iOS Simulator only runs on macOS. This is a genuine host-capability gap, not a code gap. |
| Android | **OFFLINE** | Missing dependency: `NATIVE_ANDROID_HOST_URL`. No host with the Android SDK, a booted AVD, and `adb` reachable is configured. A real Android Emulator additionally needs KVM/HAXM hardware acceleration that this container does not expose, and Vercel serverless functions cannot host a persistent emulator process either way. |

Per #28/#29/#30's explicit instruction, this is recorded as the one
unresolved acceptance item rather than substituted with viewport/User-Agent
emulation reported as native. The host integration protocol itself
(client, endpoint, Actual State contract, UI, bounded recovery, URL
validation, and regression tests) is implemented, tested, and ready: once
NORIZO points `NATIVE_IOS_HOST_URL`/`NATIVE_ANDROID_HOST_URL` at a real
macOS host (running `ios-agent.mjs`) and a real Android-SDK host (running
`android-agent.mjs`), DEV ROOM will report `NATIVE_LIVE` with live
device/runtime/URL/evidence-freshness with no further code change.

## Preserved / unaffected

- Existing PC (Steel/Playwright) path: unchanged.
- Existing Appetize iPhone/Android panes: unchanged, still honestly labeled
  "Appetize / Mobile Safari" and "Appetize / Mobile Chrome" (never claimed
  native) and kept available as the explicit fallback per the issue's
  "Appetize must not be the default... keep only as optional fallback"
  requirement — the new Native Mobile panel is additive, not a removal.
- `npm run qa:state`, `npm run qa:p3:contract` and the rest of the existing
  QA suite: all still pass unmodified.

## Cost / infrastructure policy

- No paid service added. No GitHub Actions. No Production deployment. No
  DB migration. No ConoHa/VPS. Incremental cost: JPY 0 / USD 0.
- The host agents are plain Node scripts a NORIZO/Chatty-owned machine runs
  directly; they are not a resident worker inside this repository's
  deployed surface and are not started by this routine.
