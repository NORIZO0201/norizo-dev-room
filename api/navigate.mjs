import { getProvider } from './providers/index.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const url = req.body?.url;
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const p = await getProvider();
    const ids = [req.body?.pcId, req.body?.spId].filter(Boolean);
    const urls = await Promise.all(ids.map(id => p.goto(id, url)));
    return res.status(200).json({ ok: true, provider: p.info().provider, urls });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
