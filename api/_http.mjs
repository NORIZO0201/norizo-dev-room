// Response helpers shared by every DEV ROOM function.
//
// Contract: a DEV ROOM endpoint answers with JSON on success *and* on failure,
// never with an HTML error page or bare text, so the browser client can always
// parse a reason instead of dying on `JSON.parse`. /api/snapshot is the only
// endpoint that also returns binary, and it still falls back to JSON on error.

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store, max-age=0');
  return res.end(JSON.stringify(body));
}

export function sendError(res, status, error, extra = {}) {
  const message = typeof error === 'string' ? error : (error?.message || String(error));
  // Duplicated in a header so an <img>/fetch consumer can read the reason
  // without having to parse a body it may never receive.
  res.setHeader('x-devroom-error', encodeURIComponent(message).slice(0, 300));
  return sendJson(res, status, { error: message, ...extra });
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('allow', allowed.join(', '));
  return sendError(res, 405, `Method not allowed. Use ${allowed.join(' or ')}.`);
}

export function readBody(req) {
  const body = req.body;
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

export function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}
