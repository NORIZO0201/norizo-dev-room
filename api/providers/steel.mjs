// Steel remote-browser provider.
// Session lifecycle lives here; all page operations come from _browser.mjs so
// the Steel and local-CDP providers behave identically.
import {
  DEVICE_PROFILES,
  makePageApi,
  normalizeDevice,
  profileFor,
  purgeSession
} from './_browser.mjs';

export const SESSION_MS = 840000;
export { DEVICE_PROFILES, profileFor, normalizeDevice };

function cfg() {
  const mode = process.env.BROWSER_PROVIDER || 'steel-cloud';
  const selfhost = mode === 'steel-selfhost';

  const apiBase = selfhost
    ? (process.env.STEEL_SELFHOST_API_BASE || 'http://127.0.0.1:3000/v1')
    : 'https://api.steel.dev/v1';

  const apiKey = selfhost
    ? (process.env.STEEL_SELFHOST_API_KEY || '')
    : (process.env.STEEL_API_KEY || '');

  const connectBase = selfhost
    ? (process.env.STEEL_SELFHOST_CDP_BASE || '')
    : 'wss://connect.steel.dev';

  if (!selfhost && !apiKey) throw new Error('STEEL_API_KEY is not configured.');
  return { mode, selfhost, apiBase, apiKey, connectBase };
}

function headers(apiKey) {
  const h = { 'content-type': 'application/json' };
  if (apiKey) h['steel-api-key'] = apiKey;
  return h;
}

function wsFor(sessionId) {
  const c = cfg();
  if (c.selfhost) {
    if (!c.connectBase) throw new Error('STEEL_SELFHOST_CDP_BASE is not configured.');
    const sep = c.connectBase.includes('?') ? '&' : '?';
    return `${c.connectBase}${sep}sessionId=${encodeURIComponent(sessionId)}`;
  }
  return `${c.connectBase}?apiKey=${encodeURIComponent(c.apiKey)}&sessionId=${encodeURIComponent(sessionId)}`;
}

const pageApi = makePageApi(wsFor);

export const configureMobile = pageApi.configureMobile;
export const getUrl = pageApi.getUrl;
export const goto = pageApi.goto;
export const screenshotPage = pageApi.screenshotPage;
export const tapPage = pageApi.tapPage;
export const scrollPage = pageApi.scrollPage;
export const inspectPage = pageApi.inspectPage;

/**
 * Create a Steel session whose *own* dimensions and user agent already match
 * the target device. CDP emulation overrides are reverted whenever a client
 * detaches, so the session-level values are what guarantee that a mobile pane
 * never silently falls back to a desktop viewport.
 */
export async function createSession(options = {}) {
  const c = cfg();
  const device = normalizeDevice(options.device);
  const profile = profileFor(device);

  const body = {
    timeout: SESSION_MS,
    debugConfig: { interactive: true, systemCursor: true },
    dimensions: { width: profile.width, height: profile.height }
  };
  if (profile.userAgent) body.userAgent = profile.userAgent;
  if (options.profileId) body.profileId = options.profileId;
  if (options.persistProfile) body.persistProfile = true;

  const r = await fetch(`${c.apiBase}/sessions`, {
    method: 'POST',
    headers: headers(c.apiKey),
    body: JSON.stringify(body)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Steel ${r.status}: ${text.slice(0, 500)}`);

  let s;
  try {
    s = JSON.parse(text);
  } catch {
    throw new Error(`Steel returned a non-JSON session response: ${text.slice(0, 200)}`);
  }
  if (!s?.id) throw new Error('Steel did not return a session id.');

  return {
    id: s.id,
    debugUrl: s.debugUrl || s.sessionViewerUrl || null,
    profileId: s.profileId || null,
    device,
    mobile: profile.mobile,
    viewport: { width: profile.width, height: profile.height, dpr: profile.dpr },
    label: profile.label
  };
}

export async function release(id) {
  if (!id) return;
  purgeSession(id);
  const c = cfg();
  const r = await fetch(`${c.apiBase}/sessions/${encodeURIComponent(id)}/release`, {
    method: 'POST',
    headers: headers(c.apiKey)
  });
  if (!r.ok && r.status !== 404) throw new Error(`Steel release ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

export async function profileReady(profileId) {
  if (!profileId) return false;
  const c = cfg();
  for (let i = 0; i < 12; i += 1) {
    const r = await fetch(`${c.apiBase}/profiles/${encodeURIComponent(profileId)}`, {
      headers: headers(c.apiKey)
    });
    if (r.ok) {
      const p = await r.json();
      if (p.status === 'READY') return true;
      if (p.status === 'FAILED') return false;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

export function info() {
  const c = cfg();
  return {
    provider: c.mode,
    sessionMs: SESSION_MS,
    snapshotFormat: 'image/png',
    snapshotScale: 'css',
    pooledConnections: true,
    devices: Object.keys(DEVICE_PROFILES),
    capabilities: {
      liveViewer: true,
      profiles: true,
      mobileFingerprint: true,
      humanControl: true
    }
  };
}
