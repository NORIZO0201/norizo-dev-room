import { apiKey, createSession, goto, release, SESSION_MS } from './_steel.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let key;
  try { key = apiKey(); } catch (e) { return res.status(500).json({ error: e.message }); }

  const url = typeof req.body?.url === 'string' && /^https?:\/\//i.test(req.body.url) ? req.body.url : 'https://example.com';
  let pc, sp;
  try {
    pc = await createSession(key, { dimensions: { width: 1440, height: 900 }, persistProfile: true });
    sp = await createSession(key, { deviceConfig: { device: 'mobile' }, persistProfile: true });
    await Promise.all([goto(key, pc.id, url), goto(key, sp.id, url)]);
    return res.status(200).json({
      pc: { id: pc.id, debugUrl: pc.debugUrl || pc.sessionViewerUrl, profileId: pc.profileId || null },
      sp: { id: sp.id, debugUrl: sp.debugUrl || sp.sessionViewerUrl, profileId: sp.profileId || null },
      expiresInMs: SESSION_MS,
      url
    });
  } catch (e) {
    await Promise.allSettled([release(key, pc?.id), release(key, sp?.id)]);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
