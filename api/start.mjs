import vercelFunctions from '@vercel/functions';
const { getVercelOidcToken } = vercelFunctions;
import { getProvider } from './providers/index.mjs';

const valid = d => ['iphone','android','pc'].includes(d);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const url = typeof req.body?.url === 'string' && /^https?:\/\//i.test(req.body.url) ? req.body.url : 'https://example.com';
  const devices = Array.isArray(req.body?.devices) ? req.body.devices.filter(valid) : ['iphone','android'];
  if (!devices.length) return res.status(400).json({ error: 'Select at least one device' });

  let p;
  const sessions = {};
  try {
    p = await getProvider();
    const protectedQa = /\.vercel\.app/i.test(url) && /git-dev-room-qa/i.test(url);
    const oidc = protectedQa ? getVercelOidcToken() : undefined;
    const extraHTTPHeaders = oidc ? { 'x-vercel-trusted-oidc-idp-token': oidc } : undefined;

    for (const device of devices) {
      if (device === 'pc') {
        sessions.pc = await p.createSession({ dimensions: { width: 1440, height: 900 }, persistProfile: true });
      } else {
        sessions[device] = await p.createSession({ deviceConfig: { device: 'mobile' }, persistProfile: true });
      }
    }

    const urls = {};
    await Promise.all(devices.map(async device => {
      const session = sessions[device];
      urls[device] = await p.goto(session.id, url, device === 'pc'
        ? { extraHTTPHeaders }
        : { mobile: true, deviceProfile: device, extraHTTPHeaders });
    }));

    return res.status(200).json({
      provider: p.info().provider,
      sessions,
      urls,
      devices,
      protectedQa,
      oidcAvailable: Boolean(oidc),
      expiresInMs: p.SESSION_MS,
      url
    });
  } catch (e) {
    if (p) await Promise.allSettled(Object.values(sessions).map(s => p.release(s?.id)));
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
