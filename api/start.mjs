import { getVercelOidcToken } from '@vercel/oidc';
import { getProvider } from './providers/index.mjs';

function appetizeUrl(device, url) {
  const p = new URLSearchParams({
    autoplay: 'true',
    scale: 'auto',
    orientation: 'portrait',
    screenOnly: 'true',
    codec: 'jpeg',
    launchUrl: url
  });
  if (device === 'iphone') {
    p.set('device', 'iphone16pro');
    p.set('osVersion', '18.2');
  } else {
    p.set('device', 'pixel9pro');
    p.set('osVersion', '15.0');
  }
  return 'https://appetize.io/standalone?' + p.toString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const url = typeof req.body?.url === 'string' && /^https?:\/\//i.test(req.body.url)
    ? req.body.url
    : 'https://example.com';
  const devices = Array.isArray(req.body?.devices)
    ? req.body.devices.filter(d => ['iphone', 'android', 'pc'].includes(d))
    : ['iphone', 'android'];
  if (!devices.length) return res.status(400).json({ error: 'Select at least one device' });

  const sessions = {}, urls = {}, embedUrls = {};
  let p;

  try {
    if (devices.includes('iphone')) {
      urls.iphone = url;
      embedUrls.iphone = appetizeUrl('iphone', url);
    }
    if (devices.includes('android')) {
      urls.android = url;
      embedUrls.android = appetizeUrl('android', url);
    }

    if (devices.includes('pc')) {
      p = await getProvider();
      const protectedQa = /\.vercel\.app/i.test(url) && /git-dev-room-qa/i.test(url);
      const oidc = protectedQa ? await getVercelOidcToken() : undefined;
      const extraHTTPHeaders = oidc ? { 'x-vercel-trusted-oidc-idp-token': oidc } : undefined;
      sessions.pc = await p.createSession({ dimensions: { width: 1440, height: 900 }, persistProfile: true });
      urls.pc = await p.goto(sessions.pc.id, url, { extraHTTPHeaders });
    }

    return res.status(200).json({
      sessions,
      urls,
      embedUrls,
      devices,
      expiresInMs: p?.SESSION_MS || 840000,
      url
    });
  } catch (e) {
    if (p && sessions.pc?.id) await p.release(sessions.pc.id).catch(() => {});
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
