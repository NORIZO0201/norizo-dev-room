import { apiKey, createSession, getUrl, goto, release, SESSION_MS } from './_steel.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function profileReady(key, profileId) {
  if (!profileId) return false;
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`https://api.steel.dev/v1/profiles/${encodeURIComponent(profileId)}`, { headers: { 'steel-api-key': key } });
    if (r.ok) {
      const p = await r.json();
      if (p.status === 'READY') return true;
      if (p.status === 'FAILED') return false;
    }
    await sleep(500);
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let key;
  try { key = apiKey(); } catch (e) { return res.status(500).json({ error: e.message }); }
  const oldPc = req.body?.pc, oldSp = req.body?.sp;
  if (!oldPc?.id || !oldSp?.id) return res.status(400).json({ error: 'Missing sessions' });
  let pcUrl = req.body?.fallbackUrl || 'https://example.com', spUrl = pcUrl;
  try {
    [pcUrl, spUrl] = await Promise.all([getUrl(key, oldPc.id).catch(() => pcUrl), getUrl(key, oldSp.id).catch(() => spUrl)]);
    await Promise.allSettled([release(key, oldPc.id), release(key, oldSp.id)]);
    await Promise.all([profileReady(key, oldPc.profileId), profileReady(key, oldSp.profileId)]);
    const [pc, sp] = await Promise.all([
      createSession(key, { dimensions: { width: 1440, height: 900 }, ...(oldPc.profileId ? { profileId: oldPc.profileId } : {}), persistProfile: true }),
      createSession(key, { deviceConfig: { device: 'mobile' }, ...(oldSp.profileId ? { profileId: oldSp.profileId } : {}), persistProfile: true })
    ]);
    await Promise.all([goto(key, pc.id, pcUrl), goto(key, sp.id, spUrl)]);
    return res.status(200).json({
      pc: { id: pc.id, debugUrl: pc.debugUrl || pc.sessionViewerUrl, profileId: pc.profileId || oldPc.profileId || null },
      sp: { id: sp.id, debugUrl: sp.debugUrl || sp.sessionViewerUrl, profileId: sp.profileId || oldSp.profileId || null },
      expiresInMs: SESSION_MS,
      pcUrl, spUrl
    });
  } catch (e) { return res.status(500).json({ error: e?.message || String(e) }); }
}
