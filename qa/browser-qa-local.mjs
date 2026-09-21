#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PROFILES, compareBaseline, evaluateAssertions, evidenceKey, sha256File } from './browser-qa-core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const configPath = resolve(process.argv[2] || process.env.BROWSER_QA_CONFIG || resolve(here, 'example.config.json'));
const config = JSON.parse(await readFile(configPath, 'utf8'));
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = resolve(root, config.outputDir || `artifacts/browser-qa/${runId}`);
await mkdir(outDir, { recursive: true });

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'route';
}

async function exists(path) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findBrowser() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE,
    process.env.CHROME_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error('No Chrome/Chromium executable found. Set BROWSER_EXECUTABLE.');
}

function wait(ms) {
  return new Promise(resolveWait => setTimeout(resolveWait, ms));
}

async function readDevtoolsPort(userDataDir) {
  const file = resolve(userDataDir, 'DevToolsActivePort');
  for (let i = 0; i < 100; i += 1) {
    try {
      const [port] = (await readFile(file, 'utf8')).trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {}
    await wait(50);
  }
  throw new Error('Chromium DevToolsActivePort not created.');
}

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error('CDP websocket timeout')), 10000);
      this.ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolveOpen();
      }, { once: true });
      this.ws.addEventListener('error', () => {
        clearTimeout(timer);
        rejectOpen(new Error('CDP websocket error'));
      }, { once: true });
    });

    this.ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
        else pending.resolve(message.result || {});
        return;
      }
      if (!message.method) return;
      for (const handler of this.handlers.get(message.method) || []) handler(message.params || {});
    });
  }

  on(method, handler) {
    const handlers = this.handlers.get(method) || [];
    handlers.push(handler);
    this.handlers.set(method, handlers);
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolveSend, rejectSend) => {
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.delete(id)) rejectSend(new Error(`CDP timeout: ${method}`));
      }, 30000).unref?.();
    });
  }

  close() {
    try {
      this.ws?.close();
    } catch {}
  }
}

async function createPage(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  if (!response.ok) throw new Error(`CDP create page ${response.status}`);
  return response.json();
}

async function closePage(port, id) {
  await fetch(`http://127.0.0.1:${port}/json/close/${encodeURIComponent(id)}`).catch(() => {});
}

function waitEvent(cdp, method, timeoutMs = 45000) {
  return new Promise((resolveEvent, rejectEvent) => {
    const timer = setTimeout(() => rejectEvent(new Error(`${method} timeout`)), timeoutMs);
    cdp.on(method, params => {
      clearTimeout(timer);
      resolveEvent(params);
    });
  });
}

async function evalValue(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  return result.result?.value;
}

const executable = await findBrowser();
const userDataDir = await mkdtemp(resolve(tmpdir(), 'norizo-browser-qa-'));
const chrome = spawn(executable, [
  '--headless=new',
  '--remote-debugging-port=0',
  '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${userDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--disable-background-networking',
  '--disable-sync',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-sandbox',
  'about:blank'
], { stdio: 'ignore' });

const results = [];
let failed = false;

try {
  const port = await readDevtoolsPort(userDataDir);
  const profiles = { ...DEFAULT_PROFILES, ...(config.profiles || {}) };
  const requestedProfiles = config.runProfiles || Object.keys(profiles);
  const baseline = config.baseline || {};

  for (const profileName of requestedProfiles) {
    const profile = profiles[profileName];
    if (!profile) throw new Error(`Unknown profile: ${profileName}`);

    for (const target of config.targets || []) {
      const project = target.project || 'project';
      for (const route of target.routes || [{ path: '/' }]) {
        const routePath = route.path || '/';
        const url = route.html
          ? 'about:blank'
          : (route.url ? String(route.url) : new URL(routePath, target.baseUrl).toString());
        const key = evidenceKey(project, profileName, routePath);
        const pageInfo = await createPage(port);
        const cdp = new CDP(pageInfo.webSocketDebuggerUrl);
        const consoleErrors = [];
        const pageErrors = [];
        let responseStatus = null;
        let navigationError = null;

        try {
          await cdp.connect();
          await Promise.all([
            cdp.send('Page.enable'),
            cdp.send('Runtime.enable'),
            cdp.send('Network.enable')
          ]);

          cdp.on('Runtime.consoleAPICalled', params => {
            if (params.type !== 'error') return;
            const text = (params.args || [])
              .map(arg => arg.value ?? arg.description ?? '')
              .join(' ')
              .slice(0, 1000);
            consoleErrors.push(text || 'console.error');
          });
          cdp.on('Runtime.exceptionThrown', params => {
            pageErrors.push(String(
              params.exceptionDetails?.exception?.description
              || params.exceptionDetails?.text
              || 'exception'
            ).slice(0, 1000));
          });
          cdp.on('Network.responseReceived', params => {
            if (params.type === 'Document' && params.response?.url === url) {
              responseStatus = Math.trunc(params.response.status);
            }
          });

          await cdp.send('Emulation.setDeviceMetricsOverride', {
            width: profile.width,
            height: profile.height,
            deviceScaleFactor: 1,
            mobile: Boolean(profile.isMobile),
            screenWidth: profile.width,
            screenHeight: profile.height
          });

          if (route.html) {
            const tree = await cdp.send('Page.getFrameTree');
            await cdp.send('Page.setDocumentContent', {
              frameId: tree.frameTree.frame.id,
              html: String(route.html)
            });
            responseStatus = 200;
            await wait(route.settleMs ?? 100);
          } else {
            const load = waitEvent(cdp, 'Page.loadEventFired', route.timeoutMs || 45000);
            await cdp.send('Page.navigate', { url });
            await load;
            await wait(route.settleMs ?? 300);
          }
        } catch (error) {
          navigationError = String(error?.message || error);
        }

        const selectors = route.assertions?.requiredSelectors || [];
        let browserMetrics = null;
        let screenshotPath = null;
        let screenshotSha256 = null;

        if (!navigationError) {
          browserMetrics = await evalValue(cdp, `(() => {
            const selectorList = ${JSON.stringify(selectors)};
            const images = Array.from(document.images);
            const bodyText = document.body?.innerText?.trim() || '';
            const selectorState = Object.fromEntries(selectorList.map(selector => [selector, Boolean(document.querySelector(selector))]));
            const documentWidth = Math.max(document.documentElement?.scrollWidth || 0, document.body?.scrollWidth || 0);
            return {
              url: location.href,
              title: document.title,
              readyState: document.readyState,
              bodyChars: bodyText.length,
              links: document.querySelectorAll('a[href]').length,
              images: images.length,
              brokenImages: images.filter(img => img.complete && img.naturalWidth === 0).length,
              hasVisibleContent: bodyText.length > 0 || Boolean(document.body?.children?.length),
              viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
              documentWidth,
              horizontalOverflow: documentWidth > innerWidth + 1,
              selectors: selectorState
            };
          })()`);

          const screenshot = await cdp.send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: true,
            fromSurface: true
          });
          screenshotPath = resolve(
            outDir,
            `${safeName(project)}__${safeName(profileName)}__${safeName(routePath)}.png`
          );
          await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
          screenshotSha256 = await sha256File(screenshotPath);
        }

        const metrics = {
          ...(browserMetrics || {
            url,
            title: '',
            readyState: 'navigation-error',
            bodyChars: 0,
            links: 0,
            images: 0,
            brokenImages: 0,
            hasVisibleContent: false,
            viewport: { width: profile.width, height: profile.height, dpr: 1 },
            documentWidth: 0,
            horizontalOverflow: false,
            selectors: Object.fromEntries(selectors.map(selector => [selector, false]))
          }),
          responseStatus,
          navigationError,
          consoleErrors,
          pageErrors,
          screenshotPath: screenshotPath ? screenshotPath.replace(`${root}/`, '') : null,
          screenshotSha256
        };

        const assertionFailures = navigationError
          ? [`navigation_error:${navigationError}`]
          : evaluateAssertions(metrics, route.assertions || {});
        if (responseStatus !== null && responseStatus >= 400) {
          assertionFailures.push(`http_status:${responseStatus}`);
        }
        const failures = [
          ...assertionFailures,
          ...compareBaseline(metrics, baseline[key] || {})
        ];
        if (failures.length) failed = true;

        results.push({
          key,
          project,
          profile: profileName,
          route: routePath,
          testedUrl: url,
          status: failures.length ? 'FAIL' : 'PASS',
          failures,
          metrics
        });

        cdp.close();
        await closePage(port, pageInfo.id);
      }
    }
  }
} finally {
  chrome.kill('SIGTERM');
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}

const report = {
  schemaVersion: 1,
  runId,
  provider: 'local-chromium-cdp',
  browserExecutable: basename(executable),
  config: configPath.replace(`${root}/`, ''),
  generatedAt: new Date().toISOString(),
  summary: {
    total: results.length,
    pass: results.filter(result => result.status === 'PASS').length,
    fail: results.filter(result => result.status === 'FAIL').length
  },
  results
};

const reportPath = resolve(outDir, 'report.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  ...report.summary,
  provider: report.provider,
  report: reportPath.replace(`${root}/`, '')
}, null, 2));
process.exit(failed ? 1 : 0);
