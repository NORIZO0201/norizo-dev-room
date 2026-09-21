import { getProvider } from './providers/index.mjs';
import { methodNotAllowed, readBody, sendError, sendJson } from './_http.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const p = await getProvider();
    const sessions = readBody(req).sessions || {};
    const ids = Object.values(sessions).map(s => s?.id).filter(Boolean);
    const outcome = await Promise.allSettled(ids.map(id => p.release(id)));
    const failures = outcome
      .map((r, i) => (r.status === 'rejected' ? { id: ids[i], error: String(r.reason?.message || r.reason) } : null))
      .filter(Boolean);
    return sendJson(res, 200, { ok: true, provider: p.info().provider, released: ids.length, failures });
  } catch (e) {
    return sendError(res, 500, e);
  }
}
