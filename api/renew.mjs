import { getProvider } from './providers/index.mjs';
import { isHttpUrl, methodNotAllowed, readBody, sendError, sendJson } from './_http.mjs';
import { oidcContextFor } from './_oidc.mjs';

// Sessions are time-boxed by the provider, so extending means replacing them.
// The current URL is read first, then the old sessions are released and fresh
// ones are created for the same devices and pointed back at the same page.
export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const body = readBody(req);
  const oldSessions = body.sessions || {};
  const fallbackUrl = isHttpUrl(body.fallbackUrl) ? body.fallbackUrl : 'https://example.com';
  const entries = Object.entries(oldSessions).filter(([, s]) => s?.id);
  if (!entries.length) return sendError(res, 400, 'No active device session to renew.');

  let p;
  try {
    p = await getProvider();
  } catch (e) {
    return sendError(res, 500, e);
  }

  try {
    const previousUrls = {};
    await Promise.all(entries.map(async ([device, session]) => {
      previousUrls[device] = await Promise.resolve(p.getUrl(session.id, device)).catch(() => null);
    }));

    await Promise.allSettled(entries.map(([, s]) => p.release(s.id)));

    const sessions = {};
    const urls = {};
    const ready = {};
    const failures = {};

    await Promise.all(entries.map(async ([device, old]) => {
      const previous = previousUrls[device];
      const target = isHttpUrl(previous) ? previous : fallbackUrl;
      const oidc = await oidcContextFor(target);
      let session;
      try {
        session = await p.createSession({
          device,
          ...(old.profileId ? { profileId: old.profileId } : {}),
          persistProfile: true
        });
        sessions[device] = session;

        const nav = await p.goto(session.id, target, {
          device,
          mobile: device !== 'pc',
          deviceProfile: device,
          extraHTTPHeaders: oidc.extraHTTPHeaders
        });
        urls[device] = nav.url;
        ready[device] = {
          device,
          viewport: nav.viewport,
          httpStatus: nav.status,
          navError: nav.navError,
          pageErrors: nav.errors,
          renews: true
        };
      } catch (e) {
        failures[device] = String(e?.message || e);
        if (session?.id) await Promise.resolve(p.release(session.id)).catch(() => {});
        delete sessions[device];
      }
    }));

    if (!Object.keys(sessions).length) {
      return sendError(res, 502, `Renew failed: ${Object.values(failures).join(' | ') || 'unknown error'}`, { failures });
    }

    return sendJson(res, 200, {
      ok: true,
      provider: p.info().provider,
      sessions,
      urls,
      ready,
      failures,
      devices: Object.keys(sessions),
      expiresInMs: p.SESSION_MS
    });
  } catch (e) {
    return sendError(res, 502, e);
  }
}
