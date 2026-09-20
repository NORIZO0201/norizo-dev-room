import { chromium } from 'playwright-core';

const sessions = new Map();

function endpoint() {
  const ws = process.env.PLAYWRIGHT_WS_ENDPOINT;
  if (!ws) throw new Error('PLAYWRIGHT_WS_ENDPOINT is not configured.');
  return ws;
}

async function withBrowser(fn) {
  const browser = await chromium.connectOverCDP(endpoint());
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

export async function createSession(body = {}) {
  const id = crypto.randomUUID();
  return withBrowser(async browser => {
    const context = await browser.newContext({
      viewport: body.deviceConfig?.device === 'mobile'
        ? { width: 390, height: 844 }
        : { width: body.dimensions?.width || 1440, height: body.dimensions?.height || 900 },
      isMobile: body.deviceConfig?.device === 'mobile',
      hasTouch: body.deviceConfig?.device === 'mobile'
    });
    const page = await context.newPage();
    sessions.set(id, { contextId: context._guid || null });
    return {
      id,
      debugUrl: process.env.PLAYWRIGHT_VIEWER_BASE || null,
      profileId: null,
      _local: true
    };
  });
}

export async function release() {
  // Generic remote-CDP mode cannot safely identify/close one context across stateless Vercel invocations.
  // A future local bridge will provide a context-aware release endpoint.
}

async function firstPage() {
  return withBrowser(async browser => {
    const contexts = browser.contexts();
    const pages = contexts.flatMap(c => c.pages());
    if (!pages.length) throw new Error('No active page in Playwright local provider.');
    return pages[0];
  });
}

export async function getUrl() {
  const page = await firstPage();
  return page.url();
}

export async function goto(_id, url) {
  return withBrowser(async browser => {
    const page = browser.contexts().flatMap(c => c.pages())[0];
    if (!page) throw new Error('No active page in Playwright local provider.');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    return page.url();
  });
}

export async function inspectPage() {
  return withBrowser(async browser => {
    const page = browser.contexts().flatMap(c => c.pages())[0];
    if (!page) throw new Error('No active page in Playwright local provider.');
    return page.evaluate(() => ({
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      bodyChars: (document.body?.innerText || '').trim().length,
      links: document.querySelectorAll('a[href]').length,
      images: document.images.length,
      brokenImages: Array.from(document.images).filter(i => i.complete && i.naturalWidth === 0).length,
      hasVisibleContent: !!document.body?.children?.length,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      scroll: { x: scrollX, y: scrollY }
    }));
  });
}

export async function profileReady() { return true; }

export const SESSION_MS = 24 * 60 * 60 * 1000;

export function info() {
  return {
    provider: 'playwright-local',
    sessionMs: SESSION_MS,
    capabilities: {
      liveViewer: Boolean(process.env.PLAYWRIGHT_VIEWER_BASE),
      profiles: false,
      mobileFingerprint: false,
      humanControl: Boolean(process.env.PLAYWRIGHT_VIEWER_BASE)
    }
  };
}
