import { getProvider } from './providers/index.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const p = await getProvider();
    const sessions = req.body?.sessions || {};
    await Promise.allSettled(Object.values(sessions).map(s => p.release(s?.id)));
    return res.status(200).json({ ok: true, provider: p.info().provider });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
