// Thin HTTP client from DEV ROOM (Vercel serverless) to a native host agent
// (scripts/native-host-agent/*.mjs) running on a real macOS or Android host.
// This module never simulates a result: with no host configured or reachable
// it reports OFFLINE/ERROR rather than substituting viewport emulation.
import {
  NATIVE_DEVICE_KINDS,
  resolveHostConfig,
  validateTargetUrl,
  computeActualState,
  withBoundedRetry
} from '../native-host-core.mjs';

export { NATIVE_DEVICE_KINDS };

const PROBE_TIMEOUT_MS = 4000;

async function fetchWithTimeout(url, options = {}, timeoutMs = PROBE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(config) {
  return config.token ? { authorization: `Bearer ${config.token}` } : {};
}

export async function getActualState(kind, env = process.env) {
  const { config, missingDependency } = resolveHostConfig(kind, env);
  if (!config) return computeActualState({ kind, missingDependency });

  try {
    const probe = await withBoundedRetry(async () => {
      const res = await fetchWithTimeout(`${config.url}/health`, { headers: authHeaders(config) });
      if (!res.ok) throw new Error(`HOST_HEALTH_HTTP_${res.status}`);
      return res.json();
    });
    return computeActualState({ kind, probe });
  } catch (probeError) {
    return computeActualState({ kind, probeError });
  }
}

export async function navigate(kind, url, env = process.env) {
  const { config, missingDependency } = resolveHostConfig(kind, env);
  if (!config) {
    const err = new Error(`Native host not configured for ${kind}: missing ${missingDependency}`);
    err.missingDependency = missingDependency;
    throw err;
  }
  const check = validateTargetUrl(url);
  if (!check.ok) {
    const err = new Error(`Refused to forward URL to native host: ${check.reason}`);
    err.reason = check.reason;
    throw err;
  }
  const res = await fetchWithTimeout(`${config.url}/navigate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(config) },
    body: JSON.stringify({ url: check.url })
  });
  if (!res.ok) throw new Error(`HOST_NAVIGATE_HTTP_${res.status}`);
  return res.json();
}
