import { getProvider } from './providers/index.mjs';
import { isHttpUrl, methodNotAllowed, readBody, sendError, sendJson } from './_http.mjs';
import { oidcContextFor } from './_oidc.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const body = readBody(req);
  const url = body.url;
  if (!isHttpUrl(url)) return sendError(res, 400, 'Invalid URL. An http(s) URL is required.');

  let p;
  try {
    p = await getProvider();
  } catch (e) {
    return sendError(res, 500, e);
  }

  const sessions = body.sessions || {};
  const entries = Object.entries(sessions).filter(([, s]) => s?.id);
  if (!entries.length) return sendError(res, 400, 'No active device session to navigate.');

  const oidc = await oidcContextFor(url);
  const urls = {};
  const results = {};
  const failures = {};

  await Promise.all(entries.map(async ([device, session]) => {
    try {
      const nav = await p.goto(session.id, url, {
        device,
        mobile: device !== 'pc',
        deviceProfile: device,
        extraHTTPHeaders: oidc.extraHTTPHeaders
      });
      urls[device] = nav.url;
      results[device] = {
        url: nav.url,
        httpStatus: nav.status,
        navError: nav.navError,
        pageErrors: nav.errors,
        viewport: nav.viewport
      };
    } catch (e) {
      failures[device] = String(e?.message || e);
    }
  }));

  if (!Object.keys(urls).length) {
    return sendError(res, 502, `Navigation failed: ${Object.values(failures).join(' | ') || 'unknown error'}`, { failures });
  }

  return sendJson(res, 200, {
    ok: true,
    provider: p.info().provider,
    urls,
    results,
    failures,
    requestedUrl: url,
    protectedQa: oidc.protectedQa,
    oidcAvailable: oidc.oidcAvailable,
    oidcError: oidc.oidcError
  });
}
