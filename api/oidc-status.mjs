import { sendJson } from './_http.mjs';
import { QA_PREVIEW_TARGET, getOidcToken } from './_oidc.mjs';

// Non-secret readiness probe for the protected OMNW QA Preview.
// Always answers 200 + JSON: the DEV ROOM header card must never be the reason
// a device pane fails to load.
export default async function handler(_req, res) {
  const { token, error: tokenError } = await getOidcToken();

  let status = null;
  let location = null;
  let ok = false;
  let error = tokenError;

  try {
    const response = await fetch(QA_PREVIEW_TARGET, {
      redirect: 'manual',
      headers: token ? { 'x-vercel-trusted-oidc-idp-token': token } : {}
    });
    status = response.status;
    location = response.headers.get('location');
    ok = response.ok;
  } catch (cause) {
    error = error || String(cause?.message || cause);
  }

  return sendJson(res, 200, {
    ok,
    oidcAvailable: Boolean(token),
    target: QA_PREVIEW_TARGET,
    status,
    redirectedToAuth: Boolean(location && /vercel\.com\/sso-api/i.test(location)),
    error
  });
}
