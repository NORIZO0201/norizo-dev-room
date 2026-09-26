// Pure, framework-free logic for the native mobile host integration.
// Kept import-free of Vercel/network so it can be unit tested directly.

export const NATIVE_DEVICE_KINDS = ['iphone', 'android'];

const HOST_ENV_KEYS = {
  iphone: { url: 'NATIVE_IOS_HOST_URL', token: 'NATIVE_IOS_HOST_TOKEN' },
  android: { url: 'NATIVE_ANDROID_HOST_URL', token: 'NATIVE_ANDROID_HOST_TOKEN' }
};

export function hostEnvKeys(kind) {
  const keys = HOST_ENV_KEYS[kind];
  if (!keys) throw new Error(`Unknown native device kind: ${kind}`);
  return keys;
}

// Resolves { url, token } for a device kind from env, or null plus the exact
// missing variable name so Actual State can report a precise unresolved dependency.
export function resolveHostConfig(kind, env = process.env) {
  const { url: urlKey, token: tokenKey } = hostEnvKeys(kind);
  const url = String(env[urlKey] || '').trim();
  if (!url) return { config: null, missingDependency: urlKey };
  return { config: { url, token: String(env[tokenKey] || '').trim() || null }, missingDependency: null };
}

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc00:/i,
  /^\[?fd00:/i
];

// Guards the DEV ROOM URL field before it is forwarded to a native host agent
// (xcrun simctl / adb), which otherwise has no cross-origin sandbox of its own.
export function validateTargetUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl));
  } catch {
    return { ok: false, reason: 'URL_UNPARSEABLE' };
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return { ok: false, reason: `SCHEME_NOT_ALLOWED:${parsed.protocol}` };
  }
  const hostname = parsed.hostname;
  if (BLOCKED_HOSTNAME_PATTERNS.some((re) => re.test(hostname))) {
    return { ok: false, reason: `PRIVATE_OR_LOOPBACK_HOST_BLOCKED:${hostname}` };
  }
  return { ok: true, url: parsed.toString() };
}

// Builds the exact argv for the iOS host agent to run — never shell-interpolated.
export function buildIosSimulatorLaunch({ udid, url }) {
  if (!udid) throw new Error('udid is required');
  const check = validateTargetUrl(url);
  if (!check.ok) throw new Error(`Refusing to build simctl command: ${check.reason}`);
  return { bin: 'xcrun', args: ['simctl', 'openurl', udid, check.url] };
}

// Builds the exact argv for the Android host agent to run — never shell-interpolated.
export function buildAndroidChromeLaunch({ serial, url }) {
  if (!serial) throw new Error('serial is required');
  const check = validateTargetUrl(url);
  if (!check.ok) throw new Error(`Refusing to build adb command: ${check.reason}`);
  return {
    bin: 'adb',
    args: ['-s', serial, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', check.url, 'com.android.chrome']
  };
}

export const ACTUAL_STATES = ['NATIVE_LIVE', 'OFFLINE', 'ERROR'];

// Computes the DEV ROOM "Actual State" contract for a native device kind from
// a host health probe result. Never reports NATIVE_LIVE without a fresh probe.
export function computeActualState({ kind, missingDependency, probe, probeError, probedAt = Date.now() }) {
  if (missingDependency) {
    return {
      device: kind,
      state: 'OFFLINE',
      runtime: null,
      url: null,
      lastNavigationResult: null,
      evidenceFreshnessMs: null,
      missingDependency
    };
  }
  if (probeError) {
    return {
      device: kind,
      state: 'ERROR',
      runtime: null,
      url: null,
      lastNavigationResult: null,
      evidenceFreshnessMs: null,
      missingDependency: null,
      error: String(probeError?.message || probeError)
    };
  }
  if (!probe || probe.status !== 'ok') {
    return {
      device: kind,
      state: 'ERROR',
      runtime: probe?.runtime || null,
      url: probe?.url || null,
      lastNavigationResult: probe?.lastNavigationResult || null,
      evidenceFreshnessMs: null,
      missingDependency: null,
      error: probe?.error || 'HOST_HEALTH_NOT_OK'
    };
  }
  return {
    device: kind,
    state: 'NATIVE_LIVE',
    runtime: probe.runtime || null,
    url: probe.url || null,
    lastNavigationResult: probe.lastNavigationResult || null,
    evidenceFreshnessMs: Math.max(0, probedAt - (probe.evidenceAt || probedAt)),
    missingDependency: null
  };
}

// Bounded recovery: retries a flaky host probe a capped number of times with
// exponential backoff instead of spinning forever on stale simulator/emulator state.
export async function withBoundedRetry(fn, { maxAttempts = 3, baseDelayMs = 250, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
