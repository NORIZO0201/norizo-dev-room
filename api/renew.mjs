import { getProvider } from './providers/index.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const oldSessions = req.body?.sessions || {};
  const fallbackUrl = req.body?.fallbackUrl || 'https://example.com';
  try {
    const p = await getProvider();
    const urls = {};
    for (const [device, session] of Object.entries(oldSessions)) {
      if (!session?.id) continue;
      urls[device] = await p.getUrl(session.id).catch(() => fallbackUrl);
    }
    await Promise.allSettled(Object.values(oldSessions).map(s => p.release(s?.id)));

    const sessions = {};
    for (const [device, old] of Object.entries(oldSessions)) {
      if (!old?.id) continue;
      if (device === 'pc') {
        sessions.pc = await p.createSession({
          dimensions: { width: 1440, height: 900 },
          ...(old.profileId ? { profileId: old.profileId } : {}),
          persistProfile: true
        });
      } else {
        sessions[device] = await p.createSession({
          deviceConfig: { device: 'mobile' },
          ...(old.profileId ? { profileId: old.profileId } : {}),
          persistProfile: true
        });
      }
    }

    await Promise.all(Object.entries(sessions).map(([device, session]) =>
      p.goto(session.id, urls[device] || fallbackUrl, device === 'pc' ? {} : { mobile: true, deviceProfile: device })
    ));

    return res.status(200).json({ provider: p.info().provider, sessions, urls, expiresInMs: p.SESSION_MS });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
