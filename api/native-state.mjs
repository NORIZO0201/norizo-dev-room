import { NATIVE_DEVICE_KINDS, getActualState } from './providers/native-host.mjs';

// Actual State endpoint for native iOS Simulator / Android Emulator devices.
// Distinct from /api/inspect (which reports Appetize/Steel viewport state) so
// the DEV ROOM UI never conflates emulated mobile with a real device runtime.
export default async function handler(req, res) {
  const requested = Array.isArray(req.body?.devices) && req.method === 'POST'
    ? req.body.devices
    : String(req.query?.devices || '').split(',').filter(Boolean);
  const kinds = (requested.length ? requested : NATIVE_DEVICE_KINDS).filter((d) => NATIVE_DEVICE_KINDS.includes(d));
  try {
    const entries = await Promise.all(kinds.map(async (kind) => [kind, await getActualState(kind)]));
    return res.status(200).json({ actualState: Object.fromEntries(entries), checkedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
