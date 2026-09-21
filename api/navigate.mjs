import { getProvider } from './providers/index.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const url = req.body?.url;
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const p = await getProvider();
    const pcId = req.body?.pcId;
    const spId = req.body?.spId;
    const protectedQa = /\.vercel\.app/i.test(url) && /git-dev-room-qa/i.test(url);
    const oidc = protectedQa ? process.env.VERCEL_OIDC_TOKEN : null;
    const extraHTTPHeaders = oidc
      ? { 'x-vercel-trusted-oidc-idp-token': oidc }
      : undefined;
    const deviceProfile = ['iphone','android','compact'].includes(req.body?.deviceProfile) ? req.body.deviceProfile : 'iphone';
    const [pcUrl, spUrl] = await Promise.all([
      pcId ? p.goto(pcId, url, { extraHTTPHeaders }) : Promise.resolve(null),
      spId ? p.goto(spId, url, { mobile: true, deviceProfile, extraHTTPHeaders }) : Promise.resolve(null)
    ]);
    return res.status(200).json({ ok: true, provider: p.info().provider, pcUrl, spUrl });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
