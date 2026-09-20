import { getProvider } from './providers/index.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const oldPc = req.body?.pc;
  const oldSp = req.body?.sp;
  if (!oldPc?.id || !oldSp?.id) return res.status(400).json({ error: 'Missing sessions' });

  let p;
  let pcUrl = req.body?.fallbackUrl || 'https://example.com';
  let spUrl = pcUrl;

  try {
    p = await getProvider();

    [pcUrl, spUrl] = await Promise.all([
      p.getUrl(oldPc.id).catch(() => pcUrl),
      p.getUrl(oldSp.id).catch(() => spUrl)
    ]);

    await Promise.allSettled([p.release(oldPc.id), p.release(oldSp.id)]);

    if (p.profileReady) {
      await Promise.all([
        p.profileReady(oldPc.profileId),
        p.profileReady(oldSp.profileId)
      ]);
    }

    const [pc, sp] = await Promise.all([
      p.createSession({
        dimensions: { width: 1440, height: 900 },
        ...(oldPc.profileId ? { profileId: oldPc.profileId } : {}),
        persistProfile: true
      }),
      p.createSession({
        deviceConfig: { device: 'mobile' },
        ...(oldSp.profileId ? { profileId: oldSp.profileId } : {}),
        persistProfile: true
      })
    ]);

    await Promise.all([p.goto(pc.id, pcUrl), p.goto(sp.id, spUrl)]);

    return res.status(200).json({
      provider: p.info().provider,
      pc,
      sp,
      expiresInMs: p.SESSION_MS,
      pcUrl,
      spUrl
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
