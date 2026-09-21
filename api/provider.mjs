import { getProvider } from './providers/index.mjs';
import { sendError, sendJson } from './_http.mjs';

export default async function handler(_req, res) {
  try {
    const p = await getProvider();
    return sendJson(res, 200, p.info());
  } catch (e) {
    return sendError(res, 500, e);
  }
}
