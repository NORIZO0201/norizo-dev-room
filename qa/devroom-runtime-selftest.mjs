// DEV ROOM device-runtime self-test.
//
// Runs the real Vercel Function handlers (api/start, api/snapshot,
// api/device-action, api/inspect, api/navigate, api/stop) against real Chromium
// instances driven over CDP, using a local mock site. No VPS, no Steel key, no
// Preview deploy required.
//
// It exists because the bug this suite guards against is invisible to unit
// tests: Chrome reverts `Emulation.*` overrides when the CDP client that set
// them detaches, so a provider that reconnects per operation silently serves
// desktop-sized screenshots into the mobile device frames.
//
//   BROWSER_PROVIDER=cdp-direct npm run qa:devroom:runtime
//
// Env:
//   CHROMIUM_PATH   Chromium executable (default: Playwright's bundled build)
//   KEEP_ARTIFACTS  set to keep the captured PNGs in qa/.artifacts
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ARTIFACTS = path.join(HERE, '.artifacts');

const DEVICES = {
  iphone: { width: 393, height: 852, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1' },
  android: { width: 412, height: 915, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36' }
};

// The tap target sits at a fixed absolute position so the expected device-pixel
// coordinate is known without measuring the layout.
const TAP_BOX = { left: 20, top: 200, width: 200, height: 60 };

const PAGE = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DEV ROOM MOCK</title><style>
 body{margin:0;font-family:sans-serif}
 .wide{display:none}.narrow{display:none}
 @media(min-width:800px){.wide{display:block}}
 @media(max-width:799px){.narrow{display:block}}
 header{background:#7b1d3a;color:#fff;padding:18px;font-size:20px}
 #hit{position:absolute;left:${TAP_BOX.left}px;top:${TAP_BOX.top}px;width:${TAP_BOX.width}px;height:${TAP_BOX.height}px;
      background:#0a5;color:#fff;display:grid;place-items:center;text-decoration:none}
 .card{height:420px;margin:12px;background:linear-gradient(#eee,#bbb);display:grid;place-items:center;font-size:28px}
</style></head><body>
<header>MOCK SITE</header>
<div class="wide">DESKTOP LAYOUT</div><div class="narrow">MOBILE LAYOUT</div>
<a id="hit" href="/next">TAP TARGET</a>
<div style="height:260px"></div>
<div class="card">1</div><div class="card">2</div><div class="card">3</div><div class="card">4</div>
<img src="/ok.png" width="40" height="40" alt="ok">
</body></html>`;

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wFCBQ0xAAAAAElFTkSuQmCC', 'base64');

/* -------------------------------------------------------------- test harness */
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

function mockReq({ method = 'POST', body = {}, query = {} } = {}) {
  return { method, body, query, headers: {} };
}

function mockRes() {
  const res = { statusCode: 200, headers: {}, chunks: [], ended: false };
  res.setHeader = (k, v) => { res.headers[String(k).toLowerCase()] = String(v); return res; };
  res.getHeader = k => res.headers[String(k).toLowerCase()];
  res.status = c => { res.statusCode = c; return res; };
  res.json = b => { res.setHeader('content-type', 'application/json'); res.chunks.push(Buffer.from(JSON.stringify(b))); res.ended = true; return res; };
  res.send = b => { res.chunks.push(Buffer.isBuffer(b) ? b : Buffer.from(String(b))); res.ended = true; return res; };
  res.end = b => { if (b != null) res.chunks.push(Buffer.isBuffer(b) ? b : Buffer.from(String(b))); res.ended = true; return res; };
  Object.defineProperty(res, 'buffer', { get: () => Buffer.concat(res.chunks) });
  Object.defineProperty(res, 'text', { get: () => Buffer.concat(res.chunks).toString('utf8') });
  Object.defineProperty(res, 'json_', { get: () => { try { return JSON.parse(res.text); } catch { return null; } } });
  return res;
}

async function call(handler, req) {
  const res = mockRes();
  await handler(req, res);
  return res;
}

// PNG IHDR: width/height are big-endian uint32 at offsets 16 and 20.
function pngSize(buf) {
  if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const dirs = fs.existsSync(base)
    ? fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().reverse()
    : [];
  for (const d of dirs) {
    const exe = path.join(base, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error('Chromium not found. Set CHROMIUM_PATH.');
}

/**
 * Stand-in for one remote browser session. Window size and user agent are set
 * at launch, exactly as the Steel provider now sets `dimensions` and
 * `userAgent` at session creation.
 */
async function launchDevice(device, port, profileDir) {
  const d = DEVICES[device];
  const child = spawn(chromiumPath(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    `--remote-debugging-port=${port}`,
    `--window-size=${d.width},${d.height}`,
    `--user-agent=${d.ua}`,
    `--user-data-dir=${profileDir}`,
    'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return { child, ws: (await r.json()).webSocketDebuggerUrl };
    } catch { /* not up yet */ }
    await new Promise(res => setTimeout(res, 250));
  }
  child.kill('SIGKILL');
  throw new Error(`Chromium for ${device} did not expose a CDP endpoint on ${port}`);
}

/* --------------------------------------------------------------------- main */
async function main() {
  const server = http.createServer((req, res) => {
    if (req.url === '/ok.png') {
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end(PNG_1PX);
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PAGE);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const target = `${origin}/`;

  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'devroom-qa-'));
  const launched = {};
  const cleanup = [];

  try {
    for (const [device, port] of [['iphone', 9331], ['android', 9332]]) {
      const l = await launchDevice(device, port, path.join(tmp, device));
      launched[device] = l;
      cleanup.push(() => l.child.kill('SIGKILL'));
      process.env[`DEVROOM_CDP_URL_${device.toUpperCase()}`] = l.ws;
    }
    process.env.BROWSER_PROVIDER = 'cdp-direct';

    const browserLayer = await import(path.join(ROOT, 'api/providers/_browser.mjs'));
    const start = (await import(path.join(ROOT, 'api/start.mjs'))).default;
    const snapshot = (await import(path.join(ROOT, 'api/snapshot.mjs'))).default;
    const action = (await import(path.join(ROOT, 'api/device-action.mjs'))).default;
    const inspect = (await import(path.join(ROOT, 'api/inspect.mjs'))).default;
    const navigate = (await import(path.join(ROOT, 'api/navigate.mjs'))).default;
    const stop = (await import(path.join(ROOT, 'api/stop.mjs'))).default;
    const provider = (await import(path.join(ROOT, 'api/provider.mjs'))).default;

    /* ---- 0. Baseline: session-level dimensions are applied, so a client that
             connects without emulation still gets a narrow viewport rather than
             the 1280px desktop default. Headless Chromium clamps --window-size
             to a 500px minimum, so this proves the dimensions took effect but
             not that they are exact — the per-connection emulation applied in
             _browser.mjs is what makes the viewport exact (checked below). */
    {
      const { chromium } = await import('playwright-core');
      const b = await chromium.connectOverCDP(launched.iphone.ws);
      const p = b.contexts()[0].pages()[0];
      await p.goto(target, { waitUntil: 'domcontentloaded' });
      const w = await p.evaluate(() => innerWidth);
      check('session dimensions keep a bare CDP client off the desktop layout', w < 800, `innerWidth=${w} (headless floor is 500)`);
      await b.close();
    }

    /* ---- 1. provider info */
    {
      const res = await call(provider, mockReq({ method: 'GET' }));
      check('/api/provider returns JSON 200', res.statusCode === 200 && res.json_?.provider === 'cdp-direct', res.text.slice(0, 120));
    }

    /* ---- 2. start both mobile devices */
    let started;
    {
      const res = await call(start, mockReq({ body: { url: target, devices: ['iphone', 'android'] } }));
      started = res.json_;
      check('/api/start returns JSON 200', res.statusCode === 200, `status=${res.statusCode} ${res.text.slice(0, 200)}`);
      check('/api/start creates an iPhone session id', Boolean(started?.sessions?.iphone?.id), String(started?.sessions?.iphone?.id));
      check('/api/start creates an Android session id', Boolean(started?.sessions?.android?.id), String(started?.sessions?.android?.id));
      check('/api/start reports iPhone viewport 393x852',
        started?.sessions?.iphone?.viewport?.width === 393 && started?.sessions?.iphone?.viewport?.height === 852,
        JSON.stringify(started?.sessions?.iphone?.viewport));
      check('/api/start reports Android viewport 412x915',
        started?.sessions?.android?.viewport?.width === 412 && started?.sessions?.android?.viewport?.height === 915,
        JSON.stringify(started?.sessions?.android?.viewport));
      // The point of `ready`: a session id alone never proves the device renders.
      check('/api/start verifies iPhone actually renders', started?.ready?.iphone?.renders === true, `bytes=${started?.ready?.iphone?.snapshotBytes} err=${started?.ready?.iphone?.snapshotError || '-'}`);
      check('/api/start verifies Android actually renders', started?.ready?.android?.renders === true, `bytes=${started?.ready?.android?.snapshotBytes} err=${started?.ready?.android?.snapshotError || '-'}`);
    }

    if (!started?.sessions?.iphone?.id) throw new Error('cannot continue without an iPhone session');

    /* ---- 3. snapshot is a real, device-sized PNG */
    for (const device of ['iphone', 'android']) {
      const id = started.sessions[device]?.id;
      if (!id) continue;
      const res = await call(snapshot, mockReq({ method: 'GET', query: { id, device } }));
      const size = pngSize(res.buffer);
      const want = DEVICES[device];
      check(`/api/snapshot ${device} returns image/png 200`,
        res.statusCode === 200 && res.getHeader('content-type') === 'image/png',
        `status=${res.statusCode} type=${res.getHeader('content-type')}`);
      check(`/api/snapshot ${device} body is an intact PNG with Content-Length`,
        Boolean(size) && Number(res.getHeader('content-length')) === res.buffer.length,
        `bytes=${res.buffer.length} content-length=${res.getHeader('content-length')}`);
      check(`/api/snapshot ${device} PNG is the device viewport (${want.width}x${want.height})`,
        size?.width === want.width && size?.height === want.height,
        size ? `${size.width}x${size.height}` : 'not a PNG');
      if (process.env.KEEP_ARTIFACTS) {
        fs.mkdirSync(ARTIFACTS, { recursive: true });
        fs.writeFileSync(path.join(ARTIFACTS, `${device}.png`), res.buffer);
      }
    }

    /* ---- 4. a cold function instance must still serve a device-sized PNG */
    {
      browserLayer.purgeSession(started.sessions.iphone.id);
      const res = await call(snapshot, mockReq({ method: 'GET', query: { id: started.sessions.iphone.id, device: 'iphone' } }));
      const size = pngSize(res.buffer);
      check('/api/snapshot survives a cold function instance (pool purged)',
        size?.width === 393 && size?.height === 852,
        size ? `${size.width}x${size.height}` : `status=${res.statusCode} ${res.text.slice(0, 160)}`);
    }

    /* ---- 5. QA inspection */
    let inspected;
    {
      const res = await call(inspect, mockReq({
        body: { sessions: started.sessions, expectedUrls: started.urls, requestedUrl: target, observed: started.ready }
      }));
      inspected = res.json_;
      check('/api/inspect returns JSON 200', res.statusCode === 200, `status=${res.statusCode}`);
      for (const device of ['iphone', 'android']) {
        const r = inspected?.result?.[device];
        check(`/api/inspect ${device} sees the mobile layout`,
          r?.viewport?.width === DEVICES[device].width && r?.touchPoints > 0 && r?.mobileSignals === true,
          `vp=${r?.viewport?.width}x${r?.viewport?.height} touch=${r?.touchPoints} coarse=${r?.coarsePointer} ua=${/Mobile/.test(r?.userAgent || '') ? 'MOBILE' : 'DESKTOP'}`);
        check(`/api/inspect ${device} verdict is PASS`,
          inspected?.qa?.[device] === 'PASS',
          `${inspected?.qa?.[device]} failed=[${(inspected?.reasons?.[device] || []).join(',')}] shot=${r?.screenshotBytes}B`);
      }
    }

    /* ---- 6. tap is forwarded with correct coordinates */
    for (const device of ['iphone', 'android']) {
      const id = started.sessions[device]?.id;
      if (!id) continue;
      const x = TAP_BOX.left + TAP_BOX.width / 2;
      const y = TAP_BOX.top + TAP_BOX.height / 2;
      const res = await call(action, mockReq({ body: { id, device, type: 'tap', x, y } }));
      let landed = '';
      for (let i = 0; i < 20; i += 1) {
        const inspectRes = await call(inspect, mockReq({ body: { sessions: { [device]: { id } } } }));
        landed = inspectRes.json_?.result?.[device]?.url || '';
        if (landed.endsWith('/next')) break;
        await new Promise(r => setTimeout(r, 150));
      }
      check(`/api/device-action tap navigates ${device} via the tapped link`,
        res.statusCode === 200 && landed.endsWith('/next'),
        `mode=${res.json_?.result?.mode} url=${landed}`);
    }

    /* ---- 7. scroll is forwarded in the right direction and magnitude */
    for (const device of ['iphone', 'android']) {
      const id = started.sessions[device]?.id;
      if (!id) continue;
      const down = await call(action, mockReq({ body: { id, device, type: 'scroll', deltaY: 600 } }));
      const afterDown = down.json_?.result?.scroll?.y ?? -1;
      const up = await call(action, mockReq({ body: { id, device, type: 'scroll', deltaY: -600 } }));
      const afterUp = up.json_?.result?.scroll?.y ?? -1;
      check(`/api/device-action scroll moves ${device} down then back up`,
        afterDown > 100 && afterUp < afterDown,
        `down->y=${afterDown} up->y=${afterUp}`);
    }

    /* ---- 8. navigate */
    {
      const res = await call(navigate, mockReq({ body: { sessions: started.sessions, url: `${origin}/other` } }));
      check('/api/navigate moves every device to the new URL',
        res.statusCode === 200
        && res.json_?.urls?.iphone?.endsWith('/other')
        && res.json_?.urls?.android?.endsWith('/other'),
        JSON.stringify(res.json_?.urls));
    }

    /* ---- 9. failure paths always answer JSON */
    {
      const noId = await call(snapshot, mockReq({ method: 'GET', query: {} }));
      check('/api/snapshot without an id answers JSON 400',
        noId.statusCode === 400 && typeof noId.json_?.error === 'string' && Boolean(noId.getHeader('x-devroom-error')),
        `status=${noId.statusCode} body=${noId.text.slice(0, 100)}`);

      const badMethod = await call(start, mockReq({ method: 'GET' }));
      check('/api/start rejects GET with JSON 405',
        badMethod.statusCode === 405 && typeof badMethod.json_?.error === 'string',
        `status=${badMethod.statusCode}`);

      const badAction = await call(action, mockReq({ body: { id: started.sessions.iphone.id, type: 'teleport' } }));
      check('/api/device-action rejects an unknown action with JSON 400',
        badAction.statusCode === 400 && typeof badAction.json_?.error === 'string',
        `status=${badAction.statusCode}`);

      // 'local-pc' resolves to DEVROOM_CDP_URL_PC, which this run never sets,
      // so the provider fails and the endpoint must still answer JSON.
      const deadSnapshot = await call(snapshot, mockReq({ method: 'GET', query: { id: 'local-pc', device: 'pc' } }));
      check('/api/snapshot on an unusable session answers JSON 502, never HTML',
        deadSnapshot.statusCode === 502
        && (deadSnapshot.getHeader('content-type') || '').includes('json')
        && typeof deadSnapshot.json_?.error === 'string',
        `status=${deadSnapshot.statusCode} type=${deadSnapshot.getHeader('content-type')} body=${deadSnapshot.text.slice(0, 120)}`);
    }

    /* ---- 10. stop */
    {
      const res = await call(stop, mockReq({ body: { sessions: started.sessions } }));
      check('/api/stop releases every session with JSON 200',
        res.statusCode === 200 && res.json_?.ok === true && (res.json_?.failures?.length || 0) === 0,
        res.text.slice(0, 160));
    }
  } finally {
    for (const fn of cleanup) { try { fn(); } catch {} }
    server.close();
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error('FAILED:\n' + failed.map(f => ' - ' + f.name + (f.detail ? ' (' + f.detail + ')' : '')).join('\n'));
    process.exitCode = 1;
  }
}

main().catch(e => {
  console.error('devroom-runtime-selftest crashed:', e);
  process.exitCode = 1;
});
