// Local / self-hosted CDP provider.
//
// Replaces the old `playwright-local` provider, which could not identify a
// session across stateless invocations (its `release()` was a no-op and its
// `goto()` ignored the session id entirely). This one uses the same pooled page
// layer as Steel, so `qa/devroom-runtime-selftest.mjs` exercises the exact code
// path that serves /api/snapshot, /api/device-action and /api/inspect.
//
// One CDP endpoint drives one browser, therefore one device. Point a separate
// endpoint at each device for multi-device local QA:
//   DEVROOM_CDP_URL           default endpoint
//   DEVROOM_CDP_URL_IPHONE    per-device endpoint
//   DEVROOM_CDP_URL_ANDROID
//   DEVROOM_CDP_URL_PC
import {
  DEVICE_PROFILES,
  makePageApi,
  normalizeDevice,
  profileFor,
  purgeSession
} from './_browser.mjs';

export const SESSION_MS = 24 * 60 * 60 * 1000;
export { DEVICE_PROFILES, profileFor, normalizeDevice };

const ID_PREFIX = 'local-';

function deviceFromId(id) {
  const raw = String(id || '');
  return normalizeDevice(raw.startsWith(ID_PREFIX) ? raw.slice(ID_PREFIX.length).split('-')[0] : raw);
}

function endpointFor(device) {
  const specific = process.env[`DEVROOM_CDP_URL_${device.toUpperCase()}`];
  const fallback = process.env.DEVROOM_CDP_URL || process.env.PLAYWRIGHT_WS_ENDPOINT;
  const ws = specific || fallback;
  if (!ws) {
    throw new Error(`No CDP endpoint configured. Set DEVROOM_CDP_URL or DEVROOM_CDP_URL_${device.toUpperCase()}.`);
  }
  return ws;
}

function wsFor(sessionId) {
  return endpointFor(deviceFromId(sessionId));
}

const pageApi = makePageApi(wsFor);

export const configureMobile = pageApi.configureMobile;
export const getUrl = pageApi.getUrl;
export const goto = pageApi.goto;
export const screenshotPage = pageApi.screenshotPage;
export const tapPage = pageApi.tapPage;
export const scrollPage = pageApi.scrollPage;
export const inspectPage = pageApi.inspectPage;

export async function createSession(options = {}) {
  const device = normalizeDevice(options.device);
  const profile = profileFor(device);
  endpointFor(device); // fail fast with a clear message when unconfigured
  return {
    id: `${ID_PREFIX}${device}`,
    debugUrl: process.env.DEVROOM_VIEWER_BASE || null,
    profileId: null,
    device,
    mobile: profile.mobile,
    viewport: { width: profile.width, height: profile.height, dpr: profile.dpr },
    label: profile.label
  };
}

export async function release(id) {
  // The local browser outlives the session; only our pooled client is dropped.
  purgeSession(id);
}

export async function profileReady() {
  return true;
}

export function info() {
  return {
    provider: 'cdp-direct',
    sessionMs: SESSION_MS,
    snapshotFormat: 'image/png',
    snapshotScale: 'css',
    pooledConnections: true,
    devices: Object.keys(DEVICE_PROFILES),
    capabilities: {
      liveViewer: Boolean(process.env.DEVROOM_VIEWER_BASE),
      profiles: false,
      mobileFingerprint: true,
      humanControl: Boolean(process.env.DEVROOM_VIEWER_BASE)
    }
  };
}
