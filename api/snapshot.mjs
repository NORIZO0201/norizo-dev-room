import { getProvider } from './providers/index.mjs';

export default async function handler(req, res) {
  const id = req.query?.id;
  if (!id) return res.status(400).send('Missing session id');
  try {
    const p = await getProvider();
    const png = await p.screenshotPage(id);
    res.setHeader('content-type','image/png');
    res.setHeader('cache-control','no-store, max-age=0');
    return res.status(200).send(png);
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
