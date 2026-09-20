import { apiKey, getUrl, goto } from './_steel.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let key;
  try { key = apiKey(); } catch (e) { return res.status(500).json({ error: e.message }); }
  const pcId = req.body?.pcId, spId = req.body?.spId;
  const master = req.body?.master === 'sp' ? 'sp' : 'pc';
  if (!pcId || !spId) return res.status(400).json({ error: 'Missing sessions' });
  try {
    const [pcUrl, spUrl] = await Promise.all([getUrl(key, pcId), getUrl(key, spId)]);
    const source = master === 'pc' ? pcUrl : spUrl;
    const target = master === 'pc' ? spUrl : pcUrl;
    let changed = false;
    if (source && source !== 'about:blank' && source !== target) {
      await goto(key, master === 'pc' ? spId : pcId, source);
      changed = true;
    }
    return res.status(200).json({ ok: true, changed, pcUrl: master === 'sp' && changed ? source : pcUrl, spUrl: master === 'pc' && changed ? source : spUrl, master });
  } catch (e) { return res.status(500).json({ error: e?.message || String(e) }); }
}
