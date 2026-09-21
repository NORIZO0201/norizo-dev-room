import { getVercelOidcToken } from '@vercel/functions';

export default async function handler(_req, res) {
  const token = getVercelOidcToken() || '';
  const target = 'https://oh-my-nihon-wine-git-dev-room-qa-oh-my-nihon-wine.vercel.app/welcome';
  let status = null;
  let location = null;
  let ok = false;
  let error = null;

  try {
    const response = await fetch(target, {
      redirect: 'manual',
      headers: token ? { 'x-vercel-trusted-oidc-idp-token': token } : {}
    });
    status = response.status;
    location = response.headers.get('location');
    ok = response.ok;
  } catch (cause) {
    error = cause?.message || String(cause);
  }

  return res.status(200).json({
    oidcAvailable: Boolean(token),
    target,
    status,
    ok,
    redirectedToAuth: Boolean(location && /vercel\.com\/sso-api/i.test(location)),
    error
  });
}
