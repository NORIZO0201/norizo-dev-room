import { chromium } from 'playwright-core';

export const STEEL = 'https://api.steel.dev/v1/sessions';
export const SESSION_MS = 840000;

export function apiKey() {
  const key = process.env.STEEL_API_KEY;
  if (!key) throw new Error('STEEL_API_KEY is not configured in Vercel.');
  return key;
}

export async function createSession(key, body = {}) {
  const r = await fetch(STEEL, {
    method: 'POST',
    headers: { 'steel-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ timeout: SESSION_MS, debugConfig: { interactive: true, systemCursor: true }, ...body })
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Steel ${r.status}: ${text}`);
  return JSON.parse(text);
}

export async function release(key, id) {
  if (!id) return;
  const r = await fetch(`${STEEL}/${encodeURIComponent(id)}/release`, {
    method: 'POST', headers: { 'steel-api-key': key }
  });
  if (!r.ok && r.status !== 404) throw new Error(await r.text());
}

export async function withPage(key, sessionId, fn) {
  const browser = await chromium.connectOverCDP(`wss://connect.steel.dev?apiKey=${encodeURIComponent(key)}&sessionId=${encodeURIComponent(sessionId)}`);
  try {
    const ctx = browser.contexts()[0];
    const page = ctx?.pages()[0];
    if (!page) throw new Error('No active page in Steel session.');
    return await fn(page);
  } finally {
    await browser.close();
  }
}

export async function getUrl(key, sessionId) {
  return withPage(key, sessionId, page => page.url());
}

export async function goto(key, sessionId, url) {
  return withPage(key, sessionId, async page => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    return page.url();
  });
}

export async function inspectPage(key, sessionId) {
  return withPage(key, sessionId, async page => {
    return await page.evaluate(() => {
      const imgs = Array.from(document.images);
      const brokenImages = imgs.filter(i => i.complete && i.naturalWidth === 0).length;
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const bodyText = document.body?.innerText?.trim() || '';
      return {
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        bodyChars: bodyText.length,
        links: anchors.length,
        images: imgs.length,
        brokenImages,
        hasVisibleContent: bodyText.length > 0 || document.body?.children?.length > 0,
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        scroll: { x: scrollX, y: scrollY }
      };
    });
  });
}
