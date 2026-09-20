import { getProvider } from './providers/index.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const pcId = req.body?.pcId;
  const spId = req.body?.spId;
  const master = req.body?.master === 'sp' ? 'sp' : 'pc';
  if (!pcId || !spId) return res.status(400).json({ error: 'Missing sessions' });

  try {
    const p = await getProvider();
    const [pcUrl, spUrl] = await Promise.all([p.getUrl(pcId), p.getUrl(spId)]);
    const source = master === 'pc' ? pcUrl : spUrl;
    const target = master === 'pc' ? spUrl : pcUrl;
    let changed = false;

    if (source && source !== 'about:blank' && source !== target) {
      await p.goto(master === 'pc' ? spId : pcId, source);
      changed = true;
    }

    return res.status(200).json({
      ok: true,
      provider: p.info().provider,
      changed,
      pcUrl: master === 'sp' && changed ? source : pcUrl,
      spUrl: master === 'pc' && changed ? source : spUrl,
      master
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
