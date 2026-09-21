// Vercel OIDC bridge for protected QA Previews.
//
// Only the OMNW `git-dev-room-qa` Preview needs a trusted-source token;
// Production URLs never do. `@vercel/oidc` is imported dynamically and every
// failure is captured, so a missing package, a missing token or a Vercel-side
// error can never take down device start-up or navigation — the request just
// proceeds without the header. That isolation is the whole point of this file.

const QA_PREVIEW = /\.vercel\.app/i;
const QA_BRANCH = /git-dev-room-qa/i;
export const QA_PREVIEW_TARGET = 'https://oh-my-nihon-wine-git-dev-room-qa-oh-my-nihon-wine.vercel.app/welcome';

export function needsOidc(url) {
  return typeof url === 'string' && QA_PREVIEW.test(url) && QA_BRANCH.test(url);
}

export async function getOidcToken() {
  try {
    const mod = await import('@vercel/oidc');
    const fn = mod?.getVercelOidcToken;
    if (typeof fn !== 'function') {
      return { token: null, error: '@vercel/oidc does not expose getVercelOidcToken' };
    }
    // getVercelOidcToken() is async in the current Vercel API; awaiting also
    // covers a sync string if the package ever changes back.
    const token = await fn();
    if (!token) return { token: null, error: 'Vercel OIDC token is empty' };
    return { token: String(token), error: null };
  } catch (e) {
    return { token: null, error: String(e?.message || e) };
  }
}

/**
 * Resolve the headers a device session should send for `url`.
 * Never throws.
 */
export async function oidcContextFor(url) {
  if (!needsOidc(url)) {
    return { protectedQa: false, extraHTTPHeaders: undefined, oidcAvailable: false, oidcError: null };
  }
  const { token, error } = await getOidcToken();
  return {
    protectedQa: true,
    extraHTTPHeaders: token ? { 'x-vercel-trusted-oidc-idp-token': token } : undefined,
    oidcAvailable: Boolean(token),
    oidcError: error
  };
}
