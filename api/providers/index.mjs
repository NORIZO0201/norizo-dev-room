const STEEL = new Set(['steel-cloud', 'steel-selfhost']);
// `playwright-local` is kept as an alias so an existing env value keeps working.
const LOCAL = new Set(['cdp-direct', 'playwright-local']);

export async function getProvider() {
  const name = process.env.BROWSER_PROVIDER || 'steel-cloud';
  if (STEEL.has(name)) return import('./steel.mjs');
  if (LOCAL.has(name)) return import('./cdp-direct.mjs');
  throw new Error(`Unsupported BROWSER_PROVIDER: ${name}`);
}
