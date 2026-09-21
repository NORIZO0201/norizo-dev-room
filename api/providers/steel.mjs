import { chromium } from 'playwright-core';

export const SESSION_MS = 840000;

function cfg() {
  const mode = process.env.BROWSER_PROVIDER || 'steel-cloud';
  const selfhost = mode === 'steel-selfhost';
  const apiBase = selfhost
    ? (process.env.STEEL_SELFHOST_API_BASE || 'http://127.0.0.1:3000/v1')
    : 'https://api.steel.dev/v1';

  const apiKey = selfhost
    ? (process.env.STEEL_SELFHOST_API_KEY || '')
    : (process.env.STEEL_API_KEY || '');

  const connectBase = selfhost
    ? (process.env.STEEL_SELFHOST_CDP_BASE || '')
    : 'wss://connect.steel.dev';

  if (!selfhost && !apiKey) throw new Error('STEEL_API_KEY is not configured.');
  return { mode, selfhost, apiBase, apiKey, connectBase };
}

function headers(apiKey) {
  const h = { 'content-type': 'application/json' };
  if (apiKey) h['steel-api-key'] = apiKey;
  return h;
}

export async function createSession(body = {}) {
  const c = cfg();
  const mobile = body?.deviceConfig?.device === 'mobile';
  const r = await fetch(`${c.apiBase}/sessions`, {
    method: 'POST',
    headers: headers(c.apiKey),
    body: JSON.stringify({
      timeout: SESSION_MS,
      debugConfig: { interactive: true, systemCursor: true },
      ...body
    })
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Steel ${r.status}: ${text}`);
  const s = JSON.parse(text);
  if (mobile) await configureMobile(s.id);
  return {
    id: s.id,
    debugUrl: s.debugUrl || s.sessionViewerUrl,
    profileId: s.profileId || null,
    mode: mobile ? 'mobile' : 'desktop'
  };
}

export async function release(id) {
  if (!id) return;
  const c = cfg();
  const r = await fetch(`${c.apiBase}/sessions/${encodeURIComponent(id)}/release`, {
    method: 'POST',
    headers: headers(c.apiKey)
  });
  if (!r.ok && r.status !== 404) throw new Error(await r.text());
}

export async function profileReady(profileId) {
  if (!profileId) return false;
  const c = cfg();
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`${c.apiBase}/profiles/${encodeURIComponent(profileId)}`, {
      headers: headers(c.apiKey)
    });
    if (r.ok) {
      const p = await r.json();
      if (p.status === 'READY') return true;
      if (p.status === 'FAILED') return false;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

function wsFor(sessionId) {
  const c = cfg();
  if (c.selfhost) {
    if (!c.connectBase) {
      throw new Error('STEEL_SELFHOST_CDP_BASE is not configured.');
    }
    const sep = c.connectBase.includes('?') ? '&' : '?';
    return `${c.connectBase}${sep}sessionId=${encodeURIComponent(sessionId)}`;
  }
  return `${c.connectBase}?apiKey=${encodeURIComponent(c.apiKey)}&sessionId=${encodeURIComponent(sessionId)}`;
}

async function withPage(sessionId, fn) {
  const browser = await chromium.connectOverCDP(wsFor(sessionId));
  try {
    const ctx = browser.contexts()[0];
    const page = ctx?.pages()[0];
    if (!page) throw new Error('No active page in Steel session.');
    return await fn(page);
  } finally {
    await browser.close();
  }
}

export async function configureMobile(id) {
  return withPage(id, async page => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 393,
      height: 852,
      deviceScaleFactor: 3,
      mobile: true,
      screenWidth: 393,
      screenHeight: 852,
      positionX: 0,
      positionY: 0
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5
    });
    return true;
  });
}

export async function getUrl(id) {
  return withPage(id, p => p.url());
}

export async function goto(id, url, options = {}) {
  if (options.mobile) await configureMobile(id);
  return withPage(id, async p => {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    return p.url();
  });
}

export async function inspectPage(id) {
  return withPage(id, async page => page.evaluate(() => {
    const imgs = Array.from(document.images);
    const brokenImages = imgs.filter(i => i.complete && i.naturalWidth === 0).length;
    const bodyText = document.body?.innerText?.trim() || '';
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      bodyChars: bodyText.length,
      links: document.querySelectorAll('a[href]').length,
      images: imgs.length,
      brokenImages,
      hasVisibleContent: bodyText.length > 0 || document.body?.children?.length > 0,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      screen: { width: screen.width, height: screen.height },
      userAgent: navigator.userAgent,
      touchPoints: navigator.maxTouchPoints || 0,
      coarsePointer: matchMedia('(pointer: coarse)').matches,
      mobileSignals: innerWidth <= 430 && (navigator.maxTouchPoints || 0) > 0 && /(Mobile|Android|iPhone|iPad)/i.test(navigator.userAgent),
      scroll: { x: scrollX, y: scrollY }
    };
  }));
}

export function info() {
  const c = cfg();
  return {
    provider: c.mode,
    sessionMs: SESSION_MS,
    capabilities: {
      liveViewer: true,
      profiles: true,
      mobileFingerprint: true,
      humanControl: true
    }
  };
}
