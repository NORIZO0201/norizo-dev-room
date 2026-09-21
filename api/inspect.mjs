import { getProvider } from './providers/index.mjs';
import { methodNotAllowed, readBody, sendError, sendJson } from './_http.mjs';

// QA verdict for each live device.
//
// PASS means the device actually displayed the target, not merely that a
// session exists. Every one of these must hold:
//   screenshot succeeded, body is visible, content is present, the final URL is
//   on the requested origin, the viewport really is the device viewport (and
//   mobile-signalling for iPhone/Android), no broken images, and no page errors
//   observed during navigation or inspection.
//
// Note on URL matching: an exact string match is reported separately but is not
// required, because in-site redirects (locale prefixes, trailing slashes,
// /welcome -> /) are normal and correct. Origin must match.
function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function normalizePath(url) {
  try {
    const u = new URL(url);
    return (u.pathname.replace(/\/+$/, '') || '/') + u.search;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const body = readBody(req);
  const sessions = body.sessions || {};
  const expectedUrls = body.expectedUrls || {};
  const requestedUrl = typeof body.requestedUrl === 'string' ? body.requestedUrl : '';
  const observed = body.observed || {};

  const entries = Object.entries(sessions).filter(([, s]) => s?.id);
  if (!entries.length) return sendError(res, 400, 'No active device session to inspect.');

  let p;
  try {
    p = await getProvider();
  } catch (e) {
    return sendError(res, 500, e);
  }

  const result = {};
  const qa = {};
  const reasons = {};

  for (const [device, session] of entries) {
    try {
      const info = await p.inspectPage(session.id, device);

      const expected = expectedUrls[device] || requestedUrl || '';
      const expectedOrigin = originOf(expected);
      const actualOrigin = originOf(info.url);
      const originMatches = !expectedOrigin || expectedOrigin === actualOrigin;
      const urlExact = Boolean(expected) && normalizePath(expected) === normalizePath(info.url);

      const navObserved = observed[device] || {};
      const navError = navObserved.navError || null;
      const observedErrors = Array.isArray(navObserved.pageErrors) ? navObserved.pageErrors : [];
      const allErrors = [...observedErrors, ...(info.pageErrors || [])].slice(0, 20);

      const checks = {
        screenshot: Boolean(info.screenshotOk),
        bodyVisible: Boolean(info.bodyVisible),
        content: Boolean(info.hasVisibleContent) && (info.bodyChars > 0 || info.images > 0),
        originMatches,
        viewport: Boolean(info.viewportMatches),
        mobile: info.mobileExpected ? Boolean(info.mobileSignals) : true,
        images: info.brokenImages === 0,
        noErrors: !navError && allErrors.length === 0
      };

      const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
      // A hard render failure is FAIL; softer signals (a stray console error,
      // one broken image) are CHECK so the operator can eyeball it.
      const hard = ['screenshot', 'bodyVisible', 'content', 'originMatches', 'viewport', 'mobile'];
      qa[device] = failed.length === 0
        ? 'PASS'
        : (failed.some(f => hard.includes(f)) ? 'FAIL' : 'CHECK');

      reasons[device] = failed;
      result[device] = { ...info, checks, failed, expected, urlExact, originMatches, navError, errors: allErrors };
    } catch (e) {
      qa[device] = 'FAIL';
      reasons[device] = ['inspect'];
      result[device] = { device, error: String(e?.message || e) };
    }
  }

  return sendJson(res, 200, { ok: true, provider: p.info().provider, result, qa, reasons });
}
