// Shared remote-browser page layer for every DEV ROOM provider.
//
// Why this module exists
// ---------------------
// DEV ROOM drives a remote browser over CDP from stateless Vercel Functions.
// Chrome scopes `Emulation.*` overrides to the CDP client that set them and
// reverts them the moment that client detaches. The previous implementation
// opened a fresh `connectOverCDP` connection for every single operation and
// closed it again, so `configureMobile()` applied a mobile viewport and then
// threw it away before `goto()`/`screenshot()` ever ran. Every "mobile"
// snapshot was really a desktop-sized screenshot.
//
// Two things fix that, and both are needed:
//   1. Bake the device viewport + user agent into the remote session itself
//      (see each provider's createSession), so correctness survives any
//      disconnect.
//   2. Keep one warm CDP connection per session id inside the function
//      instance, apply the emulation once on connect, and re-assert it if the
//      page ever drifts back to desktop metrics. This also removes the
//      1-3s connect handshake from every snapshot poll.
import { chromium } from 'playwright-core';

export const DEVICE_PROFILES = {
  iphone: {
    device: 'iphone',
    width: 393,
    height: 852,
    dpr: 3,
    mobile: true,
    safeTop: 59,
    safeBottom: 34,
    platform: 'iPhone',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
    label: 'iPhone class / Mobile Safari'
  },
  android: {
    device: 'android',
    width: 412,
    height: 915,
    dpr: 2.625,
    mobile: true,
    safeTop: 24,
    safeBottom: 24,
    platform: 'Linux armv8l',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    label: 'Android class / Mobile Chrome'
  },
  compact: {
    device: 'compact',
    width: 375,
    height: 812,
    dpr: 3,
    mobile: true,
    safeTop: 44,
    safeBottom: 34,
    platform: 'iPhone',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
    label: 'Compact iPhone class / Mobile Safari'
  },
  pc: {
    device: 'pc',
    width: 1440,
    height: 900,
    dpr: 1,
    mobile: false,
    label: 'PC 1440 x 900'
  }
};

export const MOBILE_DEVICES = ['iphone', 'android', 'compact'];

export function normalizeDevice(device) {
  const key = typeof device === 'string' ? device.toLowerCase() : '';
  return DEVICE_PROFILES[key] ? key : 'pc';
}

export function profileFor(device) {
  return DEVICE_PROFILES[normalizeDevice(device)];
}

export function isMobileDevice(device) {
  return profileFor(device).mobile;
}

const MAX_ERRORS = 20;
const MAX_DELTA = 4000;
const CONNECT_TIMEOUT_MS = 30000;
const TAP_SETTLE_MS = 150;
const SCROLL_SETTLE_STEP_MS = 35;
const SCROLL_SETTLE_STEPS = 12;

const pool = new Map();

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function record(entry, message) {
  if (entry.errors.length >= MAX_ERRORS) return;
  entry.errors.push(String(message).slice(0, 400));
}

function isConnectionError(message) {
  return /closed|disconnect|Target|socket|WebSocket|ECONNRESET|ECONNREFUSED|browser has been|Connection|crash|Protocol error/i.test(message);
}

export function purgeSession(id) {
  const entry = pool.get(id);
  if (!entry) return;
  pool.delete(id);
  // Detaching from a CDP-attached browser only drops our client; it does not
  // close the remote browser (verified against Chromium).
  Promise.resolve(entry.browser?.close?.()).catch(() => {});
}

export function pooledSessionIds() {
  return [...pool.keys()];
}

async function cdpFor(entry) {
  if (entry.cdp) return entry.cdp;
  entry.cdp = await entry.page.context().newCDPSession(entry.page);
  return entry.cdp;
}

async function applyEmulation(entry) {
  const p = entry.profile;
  const cdp = await cdpFor(entry);

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: p.width,
    height: p.height,
    deviceScaleFactor: p.dpr,
    mobile: Boolean(p.mobile),
    screenWidth: p.width,
    screenHeight: p.height,
    positionX: 0,
    positionY: 0,
    screenOrientation: p.mobile
      ? { type: 'portraitPrimary', angle: 0 }
      : { type: 'landscapePrimary', angle: 0 }
  });

  if (p.mobile) {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' }).catch(() => {});
    if (p.userAgent) {
      await cdp.send('Emulation.setUserAgentOverride', {
        userAgent: p.userAgent,
        platform: p.platform,
        acceptLanguage: 'ja-JP,ja;q=0.9,en;q=0.8'
      }).catch(() => {});
    }
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: p.safeTop, bottom: p.safeBottom, left: 0, right: 0 }
    }).catch(() => {});
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'pointer', value: 'coarse' }, { name: 'any-pointer', value: 'coarse' }]
    }).catch(() => {});
    // Desktop scrollbars would otherwise be baked into the snapshot and show up
    // as a grey bar down the inside of the device frame.
    await cdp.send('Emulation.setScrollbarsHidden', { hidden: true }).catch(() => {});
  }

  entry.emulated = true;
}

// A single cheap round-trip that catches the case where another function
// instance detached and reverted our overrides.
async function ensureEmulation(entry) {
  const p = entry.profile;
  try {
    const live = await entry.page.evaluate(() => [innerWidth, navigator.maxTouchPoints || 0]);
    const widthOk = Math.abs(live[0] - p.width) <= 1;
    const touchOk = !p.mobile || live[1] > 0;
    if (widthOk && touchOk) return false;
  } catch {
    // fall through and re-apply
  }
  await applyEmulation(entry);
  return true;
}

async function readScroll(page) {
  return page.evaluate(() => ({ x: scrollX, y: scrollY })).catch(() => null);
}

// Poll until the scroll offset has both moved and stopped moving, or until the
// budget (~420ms) runs out for a page that was already at its end stop.
async function settleScroll(page, before) {
  let current = before;
  let moved = false;
  let stable = 0;

  for (let i = 0; i < SCROLL_SETTLE_STEPS; i += 1) {
    await page.waitForTimeout(SCROLL_SETTLE_STEP_MS).catch(() => {});
    const now = await readScroll(page);
    if (!now) break;
    if (!moved && (now.y !== before?.y || now.x !== before?.x)) moved = true;
    stable = (now.y === current?.y && now.x === current?.x) ? stable + 1 : 0;
    current = now;
    if (moved && stable >= 2) break;
  }
  return current;
}

async function connect(id, device, wsEndpoint) {
  const browser = await chromium.connectOverCDP(wsEndpoint, { timeout: CONNECT_TIMEOUT_MS });
  let context = browser.contexts()[0];
  if (!context) {
    await browser.close().catch(() => {});
    throw new Error('Remote browser session has no browser context.');
  }
  let page = context.pages().find(p => !p.isClosed());
  if (!page) page = await context.newPage();

  const entry = {
    id,
    browser,
    context,
    page,
    cdp: null,
    profile: profileFor(device),
    errors: [],
    emulated: false
  };

  page.on('pageerror', e => record(entry, 'pageerror: ' + (e?.message || e)));
  page.on('console', m => { if (m.type() === 'error') record(entry, 'console.error: ' + m.text()); });
  page.on('crash', () => purgeSession(id));
  browser.on('disconnected', () => { if (pool.get(id) === entry) pool.delete(id); });

  await applyEmulation(entry);
  pool.set(id, entry);
  return entry;
}

/**
 * Run `fn(page, entry)` against a warm, correctly emulated page for `id`.
 * Reconnects once if the pooled connection went stale between invocations.
 */
export async function withPooledPage(id, device, wsEndpoint, fn) {
  if (!id) throw new Error('Missing browser session id.');

  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let entry = pool.get(id);

    if (entry && (!entry.browser.isConnected() || entry.page.isClosed())) {
      purgeSession(id);
      entry = null;
    }

    if (entry && device && entry.profile.device !== normalizeDevice(device)) {
      entry.profile = profileFor(device);
      entry.cdp = null;
      await applyEmulation(entry).catch(() => {});
    }

    if (!entry) entry = await connect(id, device, wsEndpoint);

    try {
      return await fn(entry.page, entry);
    } catch (e) {
      lastError = e;
      const message = String(e?.message || e);
      if (attempt === 0 && isConnectionError(message)) {
        purgeSession(id);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

export function makePageApi(resolveWs) {
  const run = (id, device, fn) => withPooledPage(id, device, resolveWs(id), fn);

  async function configureMobile(id, device = 'iphone') {
    return run(id, device, async (_page, entry) => {
      await applyEmulation(entry);
      return entry.profile;
    });
  }

  async function getUrl(id, device) {
    return run(id, device, page => page.url());
  }

  async function goto(id, url, options = {}) {
    const device = options.device
      || options.deviceProfile
      || (options.mobile ? 'iphone' : 'pc');

    return run(id, device, async (page, entry) => {
      entry.errors.length = 0;
      await ensureEmulation(entry);

      if (options.extraHTTPHeaders) {
        await page.setExtraHTTPHeaders(options.extraHTTPHeaders).catch(() => {});
      }

      let status = null;
      let navError = null;
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        status = response?.status() ?? null;
      } catch (e) {
        navError = String(e?.message || e);
      }

      // Give the document a chance to finish so the first snapshot is not blank,
      // then re-assert emulation because meta-viewport handling settles on load.
      await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
      await ensureEmulation(entry);
      await page.waitForTimeout(250);

      return {
        url: page.url(),
        status,
        navError,
        device: entry.profile.device,
        viewport: { width: entry.profile.width, height: entry.profile.height, dpr: entry.profile.dpr },
        errors: entry.errors.slice(0, MAX_ERRORS)
      };
    });
  }

  // Returned as a CSS-pixel PNG: the buffer is exactly viewport-sized, which
  // keeps snapshots small and makes browser-side tap mapping exact.
  async function screenshotPage(id, device) {
    return run(id, device, async (page, entry) => {
      await ensureEmulation(entry);
      return page.screenshot({
        type: 'png',
        fullPage: false,
        scale: 'css',
        caret: 'initial',
        timeout: 20000
      });
    });
  }

  async function tapPage(id, x, y, device) {
    return run(id, device, async (page, entry) => {
      await ensureEmulation(entry);
      const p = entry.profile;
      const tapX = clamp(x, 0, p.width - 1);
      const tapY = clamp(y, 0, p.height - 1);
      let mode = 'mouse';

      if (p.mobile) {
        try {
          const cdp = await cdpFor(entry);
          const touchPoints = [{ x: tapX, y: tapY, radiusX: 8, radiusY: 8, force: 1 }];
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints, modifiers: 0 });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], modifiers: 0 });
          mode = 'touch';
        } catch {
          // fall back to a synthetic mouse click below
        }
      }
      if (mode !== 'touch') await page.mouse.click(tapX, tapY);

      // Let a navigation or in-page reaction begin so the URL we report — and
      // the snapshot the client takes next — reflect the tap.
      await page.waitForTimeout(TAP_SETTLE_MS);
      return { ok: true, mode, x: tapX, y: tapY, url: page.url() };
    });
  }

  async function scrollPage(id, deltaY, device, deltaX = 0) {
    return run(id, device, async (page, entry) => {
      await ensureEmulation(entry);
      const p = entry.profile;
      const dy = clamp(deltaY, -MAX_DELTA, MAX_DELTA);
      const dx = clamp(deltaX, -MAX_DELTA, MAX_DELTA);

      const before = await readScroll(page);
      let mode = 'wheel';
      try {
        await page.mouse.move(Math.round(p.width / 2), Math.round(p.height / 2));
        await page.mouse.wheel(dx, dy);
      } catch {
        mode = 'scrollBy';
        await page.evaluate(
          ([sx, sy]) => (document.scrollingElement || document.documentElement).scrollBy(sx, sy),
          [dx, dy]
        ).catch(() => {});
      }

      // mouse.wheel() dispatches the event and returns; the compositor applies
      // the scroll afterwards. Without waiting for it to settle the position we
      // report is the pre-scroll one, and the next snapshot shows a stale frame.
      const scroll = await settleScroll(page, before);
      return { ok: true, mode, deltaX: dx, deltaY: dy, scrollBefore: before, scroll };
    });
  }

  async function inspectPage(id, device) {
    return run(id, device, async (page, entry) => {
      await ensureEmulation(entry);
      const p = entry.profile;

      const info = await page.evaluate(() => {
        const imgs = Array.from(document.images);
        const brokenImages = imgs.filter(i => i.complete && i.naturalWidth === 0).length;
        const body = document.body;
        const style = body ? getComputedStyle(body) : null;
        const bodyText = body?.innerText?.trim() || '';
        const bodyVisible = Boolean(
          body
          && body.offsetHeight > 0
          && style
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity || '1') > 0
        );
        return {
          url: location.href,
          title: document.title,
          readyState: document.readyState,
          bodyChars: bodyText.length,
          bodyVisible,
          links: document.querySelectorAll('a[href]').length,
          images: imgs.length,
          brokenImages,
          hasVisibleContent: bodyVisible && (bodyText.length > 0 || (body?.children?.length || 0) > 0),
          viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
          screen: { width: screen.width, height: screen.height },
          documentHeight: document.documentElement?.scrollHeight || 0,
          userAgent: navigator.userAgent,
          touchPoints: navigator.maxTouchPoints || 0,
          coarsePointer: matchMedia('(pointer: coarse)').matches,
          pwaStandalone: matchMedia('(display-mode: standalone)').matches,
          scroll: { x: scrollX, y: scrollY }
        };
      });

      let screenshotBytes = 0;
      let screenshotOk = false;
      let screenshotError = null;
      try {
        const shot = await page.screenshot({ type: 'png', fullPage: false, scale: 'css', timeout: 20000 });
        screenshotBytes = shot.length;
        screenshotOk = shot.length > 1000 && shot[0] === 0x89 && shot[1] === 0x50;
      } catch (e) {
        screenshotError = String(e?.message || e);
      }

      const mobileSignals = Boolean(
        p.mobile
        && info.viewport.width <= 460
        && info.touchPoints > 0
        && /(Mobile|Android|iPhone|iPad)/i.test(info.userAgent)
      );

      return {
        ...info,
        device: p.device,
        profile: p.label,
        expectedViewport: { width: p.width, height: p.height, dpr: p.dpr },
        viewportMatches: Math.abs(info.viewport.width - p.width) <= 1,
        mobileExpected: p.mobile,
        mobileSignals,
        screenshotOk,
        screenshotBytes,
        screenshotError,
        pageErrors: entry.errors.slice(0, MAX_ERRORS)
      };
    });
  }

  return { configureMobile, getUrl, goto, screenshotPage, tapPage, scrollPage, inspectPage };
}
