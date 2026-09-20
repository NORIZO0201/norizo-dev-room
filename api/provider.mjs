import { getProvider } from './providers/index.mjs';

export default async function handler(_req, res) {
  try {
    const p = await getProvider();
    return res.status(200).json(p.info());
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
