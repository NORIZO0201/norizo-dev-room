import { apiKey, release } from './_steel.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let key;
  try { key = apiKey(); } catch (e) { return res.status(500).json({ error: e.message }); }
  try {
    await Promise.all([release(key, req.body?.pcId), release(key, req.body?.spId)]);
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message || String(e) }); }
}
