import { getProvider } from './providers/index.mjs';
import { methodNotAllowed, readBody, sendError, sendJson } from './_http.mjs';

// Forwards a DEV ROOM gesture to the remote session.
// `x`/`y` arrive already converted to device CSS pixels by the client, which
// corrects for the `object-fit: contain` letterbox inside the device shell.
export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const { id, device, type, x, y, deltaX, deltaY } = readBody(req);
  if (!id) return sendError(res, 400, 'Missing session id.');

  try {
    const p = await getProvider();
    let result;

    if (type === 'tap') {
      if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) {
        return sendError(res, 400, 'tap requires numeric x and y.');
      }
      result = await p.tapPage(String(id), Number(x), Number(y), device);
    } else if (type === 'scroll') {
      if (!Number.isFinite(Number(deltaY)) && !Number.isFinite(Number(deltaX))) {
        return sendError(res, 400, 'scroll requires a numeric deltaY or deltaX.');
      }
      result = await p.scrollPage(String(id), Number(deltaY) || 0, device, Number(deltaX) || 0);
    } else {
      return sendError(res, 400, `Invalid action: ${String(type)}`);
    }

    return sendJson(res, 200, { ok: true, type, result });
  } catch (e) {
    return sendError(res, 502, e);
  }
}
