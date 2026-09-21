import { getProvider } from './providers/index.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const pcId = req.body?.pcId;
  const spId = req.body?.spId;
  if (!pcId || !spId) return res.status(400).json({ error: 'Missing sessions' });

  try {
    const p = await getProvider();
    if (p.configureMobile) await p.configureMobile(spId);
    const [pc, sp] = await Promise.all([p.inspectPage(pcId), p.inspectPage(spId)]);
    const gradePc = x => x.hasVisibleContent && x.brokenImages === 0 ? 'PASS' : 'CHECK';
    const gradeSp = x => x.hasVisibleContent && x.brokenImages === 0 && x.mobileSignals ? 'PASS' : 'CHECK';

    return res.status(200).json({
      provider: p.info().provider,
      pc,
      sp,
      qa: { pc: gradePc(pc), sp: gradeSp(sp) }
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
