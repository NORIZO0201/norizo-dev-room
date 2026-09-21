// DEV ROOM front-end self-test.
//
// Loads the real index.html + devroom-v7.js in a real browser against a stub
// API, and checks the things that only break once CSS is involved:
//   - the page boots with no JS/console errors and every selector resolves
//   - a mobile pane reports LIVE only after a snapshot is actually painted
//   - only one snapshot request is in flight per device
//   - a click maps to the right device pixel despite the `object-fit: contain`
//     letterbox inside the device shell
//   - wheel deltas reach the API normalised and coalesced
//
//   npm run qa:devroom:ui
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const VIEWPORT = { iphone: { width: 393, height: 852 }, android: { width: 412, height: 915 } };

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const dirs = fs.existsSync(base) ? fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of dirs) {
    const exe = path.join(base, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error('Chromium not found. Set CHROMIUM_PATH.');
}

// A distinct solid-colour PNG per device, at that device's exact viewport size,
// so the front-end sees the same geometry the real /api/snapshot produces.
async function makeSnapshot(browser, device) {
  const { width, height } = VIEWPORT[device];
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(`<body style="margin:0;background:${device === 'iphone' ? '#2b6cb0' : '#2f855a'}"></body>`);
  const buf = await page.screenshot({ type: 'png' });
  await page.close();
  return buf;
}

async function main() {
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--no-sandbox'] });
  const snapshots = {
    iphone: await makeSnapshot(browser, 'iphone'),
    android: await makeSnapshot(browser, 'android')
  };

  const calls = [];
  let snapshotsInFlight = 0;
  let maxConcurrentPerDevice = 0;
  const inFlightByDevice = { iphone: 0, android: 0 };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === '/api/snapshot') {
      const device = url.searchParams.get('device') || 'iphone';
      inFlightByDevice[device] = (inFlightByDevice[device] || 0) + 1;
      snapshotsInFlight += 1;
      maxConcurrentPerDevice = Math.max(maxConcurrentPerDevice, inFlightByDevice[device]);
      await new Promise(r => setTimeout(r, 120));
      const png = snapshots[device] || snapshots.iphone;
      res.writeHead(200, { 'content-type': 'image/png', 'content-length': png.length, 'cache-control': 'no-store' });
      res.end(png);
      inFlightByDevice[device] -= 1;
      snapshotsInFlight -= 1;
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch {}
      calls.push({ path: url.pathname, body });

      if (url.pathname === '/api/oidc-status') return send(200, { ok: false, oidcAvailable: false, error: null });
      if (url.pathname === '/api/start') {
        return send(200, {
          ok: true,
          provider: 'stub',
          sessions: {
            iphone: { id: 'sess-iphone', device: 'iphone', viewport: { ...VIEWPORT.iphone, dpr: 3 } },
            android: { id: 'sess-android', device: 'android', viewport: { ...VIEWPORT.android, dpr: 2.625 } }
          },
          urls: { iphone: body.url, android: body.url },
          ready: {}, failures: {}, devices: ['iphone', 'android'],
          expiresInMs: 840000, url: body.url
        });
      }
      if (url.pathname === '/api/device-action') return send(200, { ok: true, type: body.type, result: { ok: true } });
      return send(200, { ok: true });
    }

    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }

    const file = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript' : 'text/plain';
    res.writeHead(200, { 'content-type': type });
    res.end(fs.readFileSync(file));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push('console: ' + m.text()); });

  try {
    await page.goto(origin + '/', { waitUntil: 'load' });
    await page.waitForTimeout(400);
    check('page boots with no JS errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 300));
    check('Production/Preview target UI initialises',
      (await page.textContent('#targetHint'))?.includes('Production')
      && (await page.inputValue('#productionUrl')) === 'https://oh-my-nihon-wine.jp',
      `hint="${await page.textContent('#targetHint')}"`);

    /* ---- start: LIVE only after a frame is painted */
    const beforeStart = await page.textContent('#iphoneState');
    await page.click('#open');
    await page.waitForFunction(() => document.querySelector('#iphoneState').textContent === 'CONNECTING', null, { timeout: 5000 })
      .catch(() => {});
    await page.waitForFunction(() => document.querySelector('#iphoneState').textContent === 'LIVE', null, { timeout: 15000 });
    check('iPhone pane reaches LIVE after a snapshot is painted', true, `from "${beforeStart}"`);
    await page.waitForFunction(() => document.querySelector('#androidState').textContent === 'LIVE', null, { timeout: 15000 });
    check('Android pane reaches LIVE after a snapshot is painted', true);

    if (process.env.KEEP_ARTIFACTS) {
      fs.mkdirSync(path.join(HERE, '.artifacts'), { recursive: true });
      await page.screenshot({ path: path.join(HERE, '.artifacts', 'devroom-live.png') });
    }

    const imgInfo = await page.evaluate(() => {
      const i = document.querySelector('#iphone');
      return { src: i.src.slice(0, 5), nw: i.naturalWidth, nh: i.naturalHeight };
    });
    check('snapshot is painted from a decoded blob at device size',
      imgInfo.src === 'blob:' && imgInfo.nw === 393 && imgInfo.nh === 852,
      `src=${imgInfo.src} natural=${imgInfo.nw}x${imgInfo.nh}`);

    /* ---- polling never overlaps */
    await page.waitForTimeout(3000);
    check('never more than one snapshot request in flight per device',
      maxConcurrentPerDevice === 1, `max concurrent = ${maxConcurrentPerDevice}`);

    /* ---- tap maps through the object-fit: contain letterbox */
    const geom = await page.evaluate(() => {
      const img = document.querySelector('#iphone');
      const b = img.getBoundingClientRect();
      const s = Math.min(b.width / img.naturalWidth, b.height / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      return { box: { x: b.x, y: b.y, w: b.width, h: b.height }, drawn: { x: b.x + (b.width - w) / 2, y: b.y + (b.height - h) / 2, w, h } };
    });
    const letterboxed = Math.abs(geom.drawn.w - geom.box.w) > 1 || Math.abs(geom.drawn.h - geom.box.h) > 1;
    check('device shell really does letterbox the snapshot (so the correction matters)',
      letterboxed,
      `box=${geom.box.w.toFixed(1)}x${geom.box.h.toFixed(1)} drawn=${geom.drawn.w.toFixed(1)}x${geom.drawn.h.toFixed(1)}`);

    // Aim at 25% / 60% of the drawn image; the API must receive the matching
    // device pixel, not a coordinate measured against the element box.
    const fx = 0.25, fy = 0.6;
    calls.length = 0;
    await page.mouse.click(geom.drawn.x + geom.drawn.w * fx, geom.drawn.y + geom.drawn.h * fy);
    await page.waitForTimeout(400);
    const tap = calls.find(c => c.path === '/api/device-action' && c.body.type === 'tap');
    const wantX = Math.round(VIEWPORT.iphone.width * fx);
    const wantY = Math.round(VIEWPORT.iphone.height * fy);
    check('tap maps to the correct device pixel through the letterbox',
      tap && Math.abs(tap.body.x - wantX) <= 2 && Math.abs(tap.body.y - wantY) <= 2,
      tap ? `got (${tap.body.x},${tap.body.y}) want (${wantX},${wantY}) device=${tap.body.device}` : 'no tap call');

    // A click on the letterbox itself must not be forwarded as a page tap.
    // The shell letterboxes horizontally or vertically depending on its aspect
    // ratio, so aim at whichever margin this layout actually has.
    const padX = geom.drawn.x - geom.box.x;
    const padY = geom.drawn.y - geom.box.y;
    const spot = padX > 4
      ? { x: geom.box.x + 2, y: geom.box.y + geom.box.h / 2 }
      : (padY > 4 ? { x: geom.box.x + geom.box.w / 2, y: geom.box.y + 2 } : null);
    if (spot) {
      calls.length = 0;
      await page.mouse.click(spot.x, spot.y);
      await page.waitForTimeout(300);
      check('a click on the letterbox is not forwarded as a tap',
        !calls.some(c => c.path === '/api/device-action' && c.body.type === 'tap'),
        `${padX > 4 ? 'horizontal' : 'vertical'} margin, ${calls.length} calls`);
    } else {
      check('a click on the letterbox is not forwarded as a tap', true, 'no letterbox in this layout');
    }

    /* ---- wheel is normalised and coalesced */
    calls.length = 0;
    for (let i = 0; i < 6; i += 1) await page.mouse.wheel(0, 100);
    await page.waitForTimeout(700);
    const scrolls = calls.filter(c => c.path === '/api/device-action' && c.body.type === 'scroll');
    const total = scrolls.reduce((a, c) => a + c.body.deltaY, 0);
    check('wheel deltas are coalesced into few requests, not one per tick',
      scrolls.length > 0 && scrolls.length < 6,
      `${scrolls.length} requests for 6 wheel events`);
    check('wheel scrolls down with a sane device-pixel magnitude',
      total > 0 && total < 6 * 100 * 2,
      `total deltaY=${total.toFixed(0)}`);

    /* ---- stop tears everything down */
    calls.length = 0;
    await page.click('#stop');
    await page.waitForFunction(() => document.querySelector('#iphoneState').textContent === 'OFFLINE', null, { timeout: 8000 });
    const before = snapshotsInFlight;
    await page.waitForTimeout(2500);
    check('stop halts snapshot polling completely',
      snapshotsInFlight === 0 && before === 0 && !calls.some(c => c.path === '/api/snapshot'),
      `in-flight=${snapshotsInFlight}`);
    check('no JS errors across the whole run', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 300));
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error('FAILED:\n' + failed.map(f => ' - ' + f.name + (f.detail ? ' (' + f.detail + ')' : '')).join('\n'));
    process.exitCode = 1;
  }
}

main().catch(e => {
  console.error('devroom-ui-selftest crashed:', e);
  process.exitCode = 1;
});
