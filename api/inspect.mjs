import { getProvider } from './providers/index.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const p = await getProvider();
    const sessions = req.body?.sessions || {};
    const result = {};
    const qa = {};
    for (const [device, session] of Object.entries(sessions)) {
      if (!session?.id) continue;
      if (device !== 'pc' && p.configureMobile) await p.configureMobile(session.id, device);
      const info = await p.inspectPage(session.id);
      result[device] = info;
      qa[device] = info.hasVisibleContent && info.brokenImages === 0 && (device === 'pc' || info.mobileSignals) ? 'PASS' : 'CHECK';
    }
    return res.status(200).json({ provider: p.info().provider, result, qa });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
