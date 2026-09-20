import { apiKey, inspectPage } from './_steel.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let key;
  try { key = apiKey(); } catch (e) { return res.status(500).json({ error: e.message }); }
  const pcId = req.body?.pcId, spId = req.body?.spId;
  if (!pcId || !spId) return res.status(400).json({ error: 'Missing sessions' });
  try {
    const [pc, sp] = await Promise.all([inspectPage(key, pcId), inspectPage(key, spId)]);
    const grade = x => x.hasVisibleContent && x.brokenImages === 0 ? 'PASS' : 'CHECK';
    return res.status(200).json({ pc, sp, qa: { pc: grade(pc), sp: grade(sp) } });
  } catch (e) { return res.status(500).json({ error: e?.message || String(e) }); }
}
