# Native mobile host agents

These two scripts are **not executed by DEV ROOM's Vercel deployment or by
this cloud dev session**. They are the other end of the protocol that
`api/providers/native-host.mjs` speaks over HTTP: a small agent you run on a
machine that genuinely has the native runtime, so DEV ROOM can drive
real Apple iOS Simulator / Android Emulator sessions instead of any
viewport/User-Agent emulation.

| Device  | Host requirement                              | Agent               |
|---------|------------------------------------------------|----------------------|
| iPhone  | macOS + Xcode (Simulator.app, `xcrun simctl`)   | `ios-agent.mjs`      |
| Android | Android SDK + emulator/AVD, `adb` on PATH       | `android-agent.mjs`  |

Neither Vercel serverless functions nor this Linux cloud container can run
`xcrun simctl` (macOS-only) or a full Android Emulator (needs KVM/HAXM and
the Android SDK), which is exactly the unavailable native-host dependency
recorded in `docs/evidence/2026-09-25-NATIVE-MOBILE-HOST-INTEGRATION.md`.
Point DEV ROOM at a real host by setting, in the Vercel project:

- `NATIVE_IOS_HOST_URL` / `NATIVE_IOS_HOST_TOKEN`
- `NATIVE_ANDROID_HOST_URL` / `NATIVE_ANDROID_HOST_TOKEN`

and running the matching agent on that host, reachable at that URL.

## Protocol

Both agents expose:

- `GET /health` → `{ status: 'ok', runtime, url, lastNavigationResult, evidenceAt }`
  (or `{ status: 'error', error }` if the simulator/emulator/adb device isn't ready).
- `POST /navigate` `{ url }` → runs the native launch command and returns
  `{ ok: true, runtime, url }`.

Both share command construction with DEV ROOM's own unit tests via
`api/native-host-core.mjs` (`buildIosSimulatorLaunch` / `buildAndroidChromeLaunch`),
so the exact argv run on the host is covered by `qa/native-host-selftest.mjs`
without needing `xcrun`/`adb` to be installed in CI.

## Running

```
# on a macOS host with Xcode installed
NATIVE_HOST_TOKEN=... IOS_SIMULATOR_UDID=<udid from `xcrun simctl list devices`> \
  node scripts/native-host-agent/ios-agent.mjs

# on a host with the Android SDK + a booted AVD
NATIVE_HOST_TOKEN=... ANDROID_SERIAL=<serial from `adb devices`> \
  node scripts/native-host-agent/android-agent.mjs
```

Each agent boots its own simulator/emulator if `AUTO_BOOT=1` is set; by
default it expects one already running, to keep the bounded-recovery logic
in `api/native-host-core.mjs#withBoundedRetry` simple to reason about.
