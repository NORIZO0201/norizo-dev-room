# DEV ROOM real mobile QA (iOS Simulator + Android Emulator) — Issue #35

Date: 2026-09-26
Order: `dev-order` Issue [#35](https://github.com/NORIZO0201/norizo-dev-room/issues/35)
Continues: #28, #29, #30 (implemented in PR #31, unmerged) and #33 (AGENTS.md web-dev lane)
Result: **native host bridge/adapter carried forward and closed-loop gaps fixed; both native devices remain Actual State OFFLINE — a genuine host-capability gap, not a code gap**

## Audit (read first, per Issue #35 and AGENTS.md)

- `AGENTS.md`, `README.md`, `docs/DEV_ROOM_ARCHITECTURE.md` — DEV ROOM is P1–P5 complete,
  on-demand maintenance only, no VPS/ConoHa, Preview-first release flow.
- `index.html` / `devroom-v7.js` (main, before this change) — the PC live/debug viewer
  (Steel/Playwright) is unchanged and working. iPhone/Android were only ever
  Appetize embeds (a hosted device-cloud, explicitly disallowed by #35 as
  "canonical"), with no capability-detection or Actual State contract.
- PR #31 (`claude/blissful-ptolemy-tj1sqz`, still open) already implements almost
  exactly what #35 asks for: `api/native-host-core.mjs` (env resolution, SSRF-guarded
  URL validation, exact `xcrun simctl`/`adb` argv builders, Actual State contract,
  bounded retry), `api/providers/native-host.mjs` (HTTP client to a real host agent),
  `api/native-state.mjs` (Actual State endpoint), `scripts/native-host-agent/*`
  (the real macOS/Android-SDK-side agents), a "NATIVE MOBILE" UI panel, and
  `qa/native-host-selftest.mjs`. It was never merged to `main`.
- Recent PRs #30–#34: #31 is the native-mobile implementation above; #32 is an
  unrelated QA-webhook smoke test; #33 is the `web-dev` closed-loop AGENTS.md rule
  (same-PR repair instead of a second PR).

## Diagnose — what #35 still required beyond PR #31

1. `api/start.mjs` (initial "起動"/open-devices dispatch) never forwarded the
   resolved URL to a configured native host — only `api/navigate.mjs` ("Go") did.
   A NORIZO/Chatty session that opens devices and never clicks "Go" again would
   never reach a real native host even once one is configured.
2. Issue #35's own acceptance text: "Search existing reachable Mac/local execution
   assets before declaring HUMAN_ONLY" had not been re-verified inside *this*
   session/order.
3. "Production URL and Preview URL remain distinct visible values" was true in the
   underlying data (`state/PREVIEW_REGISTRY.json` carries both `production_url` and
   `preview_url` per project) but the UI only ever surfaced the Preview URL as a
   standalone, always-visible field; the Production URL was only implicit in the
   `#url` field depending on the currently selected `environment`.
4. No regression test existed for "a URL reaches every requested native device
   kind and a missing/unreachable host is reported per device, never thrown."

## Fix

- `api/providers/native-host.mjs`: added `navigateMany(devices, url, env)` — the
  one shared, best-effort fan-out (never throws; returns `{ok, result|error}` per
  device) used by both endpoints.
- `api/start.mjs`: now calls `navigateMany` after building Appetize/PC sessions and
  returns `nativeState` in the response, so the very first dispatch of the selected
  URL reaches a configured native host, not only a later "Go".
- `api/navigate.mjs`: simplified to call the same shared `navigateMany` instead of
  duplicating the fan-out inline.
- `devroom-v7.js`: `applySession()` now also calls `pollNativeState()` immediately
  after opening devices (previously only polled every 15s and after "Go"), and a
  new `productionUrlFor(project)` reads `production_url` from the preview registry
  (falling back to the selected project's own canonical URL).
- `index.html`: the "LATEST PREVIEW" card is now "PREVIEW / PRODUCTION" with two
  always-visible rows (`#previewUrlState`, `#productionUrlState`), so Preview and
  Production URLs are simultaneously visible regardless of the selected
  environment, per #35's explicit requirement.
- `qa/native-host-selftest.mjs`: added three deterministic checks for
  `navigateMany` — per-device missing-dependency reporting, non-native devices
  (`pc`) are ignored rather than erroring, and a disallowed URL scheme is blocked
  per device rather than throwing for the whole batch.

## Search for reachable Mac/local execution assets (this session)

Run directly in this cloud development container before declaring the native
devices HUMAN_ONLY:

```
$ which xcrun xcodebuild simctl adb emulator sdkmanager avdmanager
(no output — none found)
$ uname -a
Linux ... x86_64 GNU/Linux           # not Darwin/macOS
$ env | grep -i android
(no output — no ANDROID_HOME/ANDROID_SDK_ROOT)
$ ls -la /dev/kvm
ls: cannot access '/dev/kvm': No such file or directory
```

No macOS/Xcode host and no Android-SDK/KVM-capable host is reachable from this
Vercel-deployed app or from this cloud development session. ConoHa/VPS is
permanently retired per `AGENTS.md` and is not searched or depended on. This
confirms the OFFLINE Actual State below is accurate, not a placeholder.

## Tests executed

```
npm run qa:native-host      # 14 checks, ok:true (11 existing + 3 new navigateMany checks)
npm run qa:state            # ok:true, P1-P5 still complete
npm run qa:workers           # ok:true
npm run qa:p3:contract      # ok:true — existing PC/SP viewport gate unaffected
npm run qa:p4:workers       # ok:true
npm run qa:p5               # ok:true
npm run qa:maintenance      # ok:true
node --check <every edited .mjs file and devroom-v7.js>   # all OK
node -e "JSON.parse(readFileSync('state/DEV_ROOM_STATE.json'))"  # valid
```

## QA result / Actual State

| Device | Actual State | Detail |
| --- | --- | --- |
| PC | preserved | Steel/Playwright desktop live/debug viewer unchanged. |
| iPhone | **OFFLINE** | Missing `NATIVE_IOS_HOST_URL`. No macOS+Xcode host reachable (see search above). |
| Android | **OFFLINE** | Missing `NATIVE_ANDROID_HOST_URL`. No Android-SDK/KVM host reachable (see search above). |

This cloud session cannot browser-verify the Vercel Preview UI directly (no
outbound access to `*.vercel.app` from this sandbox in prior orders); NORIZO/Chatty
confirms the "PREVIEW / PRODUCTION" card and immediate native-state refresh
visually via the Preview URL once deployed.

## Before → After

- Before (main): iPhone/Android = Appetize embed only; no capability detection;
  no Actual State contract; Preview URL was the only always-visible release
  target; native dispatch (once PR #31 merges) would only occur on "Go", not on
  initial device open.
- After (this branch): the same honestly-labeled native host bridge/adapter from
  PR #31, plus: initial-dispatch parity between `/api/start` and `/api/navigate`,
  both Preview and Production URLs always visible together, and three additional
  deterministic tests for the shared dispatch path. Appetize remains, unchanged,
  as the explicit non-canonical fallback.

## Remaining unresolved count

2 — iPhone native host, Android native host. Both are host-capability gaps
outside this repo/session (require a real macOS+Xcode machine and a real
Android-SDK+KVM machine respectively), not code gaps. They resolve with no
further code change once NORIZO/Chatty points `NATIVE_IOS_HOST_URL` /
`NATIVE_ANDROID_HOST_URL` at a machine running the matching
`scripts/native-host-agent/*.mjs` agent.

## Cost / infrastructure policy

JPY 0 / USD 0 incremental. No GitHub Actions, no Production deploy, no DB
migration, no paid API/device cloud, no ConoHa/VPS, no GMK/COMMAND_BOARD/
factory_requests.
