import { getProvider } from './providers/index.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  const { id, type, x, y, deltaY } = req.body || {};
  if (!id) return res.status(400).json({error:'Missing session id'});
  try {
    const p = await getProvider();
    if (type === 'tap') await p.tapPage(id, x, y);
    else if (type === 'scroll') await p.scrollPage(id, deltaY);
    else return res.status(400).json({error:'Invalid action'});
    return res.status(200).json({ok:true});
  } catch (e) {
    return res.status(500).json({error:e?.message || String(e)});
  }
}
