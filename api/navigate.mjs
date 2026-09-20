import { apiKey, goto } from './_steel.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let key;
  try { key = apiKey(); } catch (e) { return res.status(500).json({ error: e.message }); }
  const url = req.body?.url;
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Invalid URL' });
  const ids = [req.body?.pcId, req.body?.spId].filter(Boolean);
  try {
    const urls = await Promise.all(ids.map(id => goto(key, id, url)));
    return res.status(200).json({ ok: true, urls });
  } catch (e) { return res.status(500).json({ error: e?.message || String(e) }); }
}
