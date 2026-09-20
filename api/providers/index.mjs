export async function getProvider() {
  const name = process.env.BROWSER_PROVIDER || 'steel-cloud';
  if (name === 'steel-cloud' || name === 'steel-selfhost') {
    return import('./steel.mjs');
  }
  if (name === 'playwright-local') {
    return import('./playwright-local.mjs');
  }
  throw new Error(`Unsupported BROWSER_PROVIDER: ${name}`);
}
