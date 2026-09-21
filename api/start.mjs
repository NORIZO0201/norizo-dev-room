import vercelFunctions from '@vercel/functions';
const { getVercelOidcToken } = vercelFunctions;
import { getProvider } from './providers/index.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = typeof req.body?.url === 'string' && /^https?:\/\//i.test(req.body.url)
    ? req.body.url
    : 'https://example.com';

  const deviceProfile = ['iphone','android','compact'].includes(req.body?.deviceProfile) ? req.body.deviceProfile : 'iphone';

  let p, pc, sp;
  try {
    p = await getProvider();
    pc = await p.createSession({ dimensions: { width: 1440, height: 900 }, persistProfile: true });
    sp = await p.createSession({ deviceConfig: { device: 'mobile' }, persistProfile: true });

    const protectedQa = /\.vercel\.app/i.test(url) && /git-dev-room-qa/i.test(url);
    const oidc = protectedQa ? getVercelOidcToken() : undefined;
    const extraHTTPHeaders = oidc
      ? { 'x-vercel-trusted-oidc-idp-token': oidc }
      : undefined;

    const [pcUrl, spUrl] = await Promise.all([
      p.goto(pc.id, url, { extraHTTPHeaders }),
      p.goto(sp.id, url, { mobile: true, deviceProfile, extraHTTPHeaders })
    ]);

    return res.status(200).json({
      provider: p.info().provider,
      pc,
      sp,
      pcUrl,
      spUrl,
      deviceProfile,
      protectedQa,
      oidcAvailable: Boolean(oidc),
      expiresInMs: p.SESSION_MS,
      url
    });
  } catch (e) {
    if (p) await Promise.allSettled([p.release(pc?.id), p.release(sp?.id)]);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
