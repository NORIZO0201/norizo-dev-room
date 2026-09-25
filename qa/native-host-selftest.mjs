#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  NATIVE_DEVICE_KINDS,
  hostEnvKeys,
  resolveHostConfig,
  validateTargetUrl,
  buildIosSimulatorLaunch,
  buildAndroidChromeLaunch,
  computeActualState,
  withBoundedRetry
} from '../api/native-host-core.mjs';

// --- device kinds / env key mapping -----------------------------------
assert.deepEqual(NATIVE_DEVICE_KINDS, ['iphone', 'android']);
assert.deepEqual(hostEnvKeys('iphone'), { url: 'NATIVE_IOS_HOST_URL', token: 'NATIVE_IOS_HOST_TOKEN' });
assert.deepEqual(hostEnvKeys('android'), { url: 'NATIVE_ANDROID_HOST_URL', token: 'NATIVE_ANDROID_HOST_TOKEN' });
assert.throws(() => hostEnvKeys('desktop'));

// --- resolveHostConfig: exact missing dependency, not a generic error --
{
  const { config, missingDependency } = resolveHostConfig('iphone', {});
  assert.equal(config, null);
  assert.equal(missingDependency, 'NATIVE_IOS_HOST_URL');
}
{
  const { config, missingDependency } = resolveHostConfig('android', { NATIVE_ANDROID_HOST_URL: ' https://host:8788 ' });
  assert.equal(missingDependency, null);
  assert.deepEqual(config, { url: 'https://host:8788', token: null });
}

// --- validateTargetUrl: allowlist + SSRF guard -------------------------
assert.equal(validateTargetUrl('https://example.com/path').ok, true);
assert.equal(validateTargetUrl('http://example.com').ok, true);
assert.equal(validateTargetUrl('not a url').reason, 'URL_UNPARSEABLE');
assert.equal(validateTargetUrl('javascript:alert(1)').reason.startsWith('SCHEME_NOT_ALLOWED'), true);
assert.equal(validateTargetUrl('file:///etc/passwd').reason.startsWith('SCHEME_NOT_ALLOWED'), true);
for (const blocked of ['http://localhost', 'http://127.0.0.1', 'http://10.0.0.5', 'http://192.168.1.1', 'http://169.254.169.254']) {
  const result = validateTargetUrl(blocked);
  assert.equal(result.ok, false, `${blocked} must be blocked`);
  assert.equal(result.reason.startsWith('PRIVATE_OR_LOOPBACK_HOST_BLOCKED'), true);
}

// --- command construction: exact argv, never shell-interpolated --------
{
  const { bin, args } = buildIosSimulatorLaunch({ udid: 'ABCD-1234', url: 'https://example.com/qa' });
  assert.equal(bin, 'xcrun');
  assert.deepEqual(args, ['simctl', 'openurl', 'ABCD-1234', 'https://example.com/qa']);
}
assert.throws(() => buildIosSimulatorLaunch({ udid: '', url: 'https://example.com' }), /udid is required/);
assert.throws(() => buildIosSimulatorLaunch({ udid: 'x', url: 'javascript:alert(1)' }), /SCHEME_NOT_ALLOWED/);
{
  const { bin, args } = buildAndroidChromeLaunch({ serial: 'emulator-5554', url: 'https://example.com/qa' });
  assert.equal(bin, 'adb');
  assert.deepEqual(args, ['-s', 'emulator-5554', 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'https://example.com/qa', 'com.android.chrome']);
}
assert.throws(() => buildAndroidChromeLaunch({ serial: '', url: 'https://example.com' }), /serial is required/);

// --- computeActualState: never reports NATIVE_LIVE without a fresh probe
{
  const state = computeActualState({ kind: 'iphone', missingDependency: 'NATIVE_IOS_HOST_URL' });
  assert.equal(state.state, 'OFFLINE');
  assert.equal(state.missingDependency, 'NATIVE_IOS_HOST_URL');
}
{
  const state = computeActualState({ kind: 'android', probeError: new Error('fetch failed') });
  assert.equal(state.state, 'ERROR');
  assert.equal(state.error, 'fetch failed');
}
{
  const state = computeActualState({ kind: 'android', probe: { status: 'error', error: 'ADB_DEVICE_NOT_READY:offline' } });
  assert.equal(state.state, 'ERROR');
  assert.equal(state.error, 'ADB_DEVICE_NOT_READY:offline');
}
{
  const probedAt = 1_000_000;
  const state = computeActualState({
    kind: 'iphone',
    probe: { status: 'ok', runtime: 'iPhone 16 Pro', url: 'https://example.com', lastNavigationResult: 'REQUESTED', evidenceAt: 999_400 },
    probedAt
  });
  assert.equal(state.state, 'NATIVE_LIVE');
  assert.equal(state.runtime, 'iPhone 16 Pro');
  assert.equal(state.evidenceFreshnessMs, 600);
}

// --- bounded recovery: capped attempts, no infinite retry loop ---------
{
  let calls = 0;
  await assert.rejects(
    withBoundedRetry(async () => { calls++; throw new Error('down'); }, { maxAttempts: 3, baseDelayMs: 0 }),
    /down/
  );
  assert.equal(calls, 3);
}
{
  let calls = 0;
  const result = await withBoundedRetry(async () => {
    calls++;
    if (calls < 2) throw new Error('transient');
    return 'recovered';
  }, { maxAttempts: 3, baseDelayMs: 0 });
  assert.equal(result, 'recovered');
  assert.equal(calls, 2);
}

console.log(JSON.stringify({
  ok: true,
  contract: 'api/native-host-core.mjs',
  checks: [
    'host_env_key_mapping',
    'exact_missing_dependency_reported',
    'url_scheme_allowlist',
    'ssrf_private_loopback_blocked',
    'ios_command_construction',
    'android_command_construction',
    'actual_state_never_live_without_fresh_probe',
    'actual_state_error_surface',
    'evidence_freshness_computation',
    'bounded_retry_caps_attempts',
    'bounded_retry_recovers_within_cap'
  ]
}, null, 2));
