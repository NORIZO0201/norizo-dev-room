import { getProvider } from './providers/index.mjs';
import { methodNotAllowed, sendError } from './_http.mjs';

// Returns the device viewport as a raw PNG.
//
// `res.end(buffer)` is used rather than `res.send()` so the body is written as
// binary with an explicit Content-Length and no chance of the framework
// re-encoding it. Every failure path still answers JSON (plus an
// x-devroom-error header) so the browser can report a reason.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(res, ['GET', 'HEAD']);

  const id = req.query?.id;
  const device = req.query?.device;
  if (!id) return sendError(res, 400, 'Missing session id.');

  try {
    const p = await getProvider();
    const png = await p.screenshotPage(String(id), device ? String(device) : undefined);
    const buf = Buffer.isBuffer(png) ? png : Buffer.from(png);

    if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50) {
      return sendError(res, 502, `Snapshot is not a valid PNG (${buf.length} bytes).`);
    }

    res.statusCode = 200;
    res.setHeader('content-type', 'image/png');
    res.setHeader('content-length', String(buf.length));
    res.setHeader('cache-control', 'no-store, max-age=0, must-revalidate');
    res.setHeader('x-devroom-bytes', String(buf.length));
    if (req.method === 'HEAD') return res.end();
    return res.end(buf);
  } catch (e) {
    // 502, not 500: the DEV ROOM function is fine, the upstream browser session
    // is not. The client backs off on this instead of tearing the pane down.
    return sendError(res, 502, e);
  }
}
