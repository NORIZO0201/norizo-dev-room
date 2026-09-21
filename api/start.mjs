import { getProvider } from './providers/index.mjs';
import { isHttpUrl, methodNotAllowed, readBody, sendError, sendJson } from './_http.mjs';
import { oidcContextFor } from './_oidc.mjs';

const VALID = new Set(['iphone', 'android', 'pc']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const body = readBody(req);
  const url = isHttpUrl(body.url) ? body.url : 'https://example.com';
  const devices = Array.isArray(body.devices) ? body.devices.filter(d => VALID.has(d)) : ['iphone', 'android'];
  if (!devices.length) return sendError(res, 400, 'Select at least one device.');

  let p;
  try {
    p = await getProvider();
  } catch (e) {
    return sendError(res, 500, e);
  }

  const oidc = await oidcContextFor(url);
  const sessions = {};
  const urls = {};
  const ready = {};
  const failures = {};

  // Each device is started independently: a failing iPhone must not blank out
  // a working Android pane.
  await Promise.all(devices.map(async device => {
    let session;
    try {
      session = await p.createSession({ device, persistProfile: true });
      sessions[device] = session;

      const nav = await p.goto(session.id, url, {
        device,
        mobile: device !== 'pc',
        deviceProfile: device,
        extraHTTPHeaders: oidc.extraHTTPHeaders
      });
      urls[device] = nav.url;

      // A session id alone proves nothing. Take one real screenshot so the
      // response reports whether this device can actually render.
      let snapshotBytes = 0;
      let snapshotError = null;
      if (device === 'pc') {
        snapshotBytes = -1; // PC uses the provider's live viewer, not snapshots
      } else {
        try {
          const shot = await p.screenshotPage(session.id, device);
          snapshotBytes = shot?.length || 0;
        } catch (e) {
          snapshotError = String(e?.message || e);
        }
      }

      ready[device] = {
        device,
        viewport: nav.viewport,
        httpStatus: nav.status,
        navError: nav.navError,
        pageErrors: nav.errors,
        snapshotBytes,
        snapshotError,
        renders: device === 'pc' ? Boolean(session.debugUrl) : snapshotBytes > 1000
      };
    } catch (e) {
      failures[device] = String(e?.message || e);
      if (session?.id) await Promise.resolve(p.release(session.id)).catch(() => {});
      delete sessions[device];
    }
  }));

  if (!Object.keys(sessions).length) {
    return sendError(res, 502, `No device session could be started: ${Object.values(failures).join(' | ') || 'unknown error'}`, {
      failures,
      provider: safeProvider(p)
    });
  }

  return sendJson(res, 200, {
    ok: true,
    provider: safeProvider(p),
    sessions,
    urls,
    ready,
    failures,
    devices: Object.keys(sessions),
    protectedQa: oidc.protectedQa,
    oidcAvailable: oidc.oidcAvailable,
    oidcError: oidc.oidcError,
    expiresInMs: p.SESSION_MS,
    url
  });
}

function safeProvider(p) {
  try {
    return p.info().provider;
  } catch {
    return 'unknown';
  }
}
