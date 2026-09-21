#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import {
  DEFAULT_PROFILES,
  compareBaseline,
  evaluateAssertions,
  evidenceKey,
  sha256File
} from './browser-qa-core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const configPath = resolve(process.argv[2] || process.env.BROWSER_QA_CONFIG || resolve(here, 'example.config.json'));
const config = JSON.parse(await readFile(configPath, 'utf8'));
const apiKey = process.env.STEEL_API_KEY;
if (!apiKey) {
  console.error('STEEL_API_KEY is required for managed browser QA.');
  process.exit(2);
}

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = resolve(root, 'artifacts/browser-qa', runId);
await mkdir(outDir, { recursive: true });

const profiles = { ...DEFAULT_PROFILES, ...(config.profiles || {}) };
const requestedProfiles = config.runProfiles || Object.keys(profiles);
const baseline = config.baseline || {};
const results = [];
let failed = false;

async function createSteelSession() {
  const response = await fetch('https://api.steel.dev/v1/sessions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'steel-api-key': apiKey
    },
    body: JSON.stringify({
      timeout: 300000,
      inactivityTimeout: 60000,
      debugConfig: { interactive: false }
    })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Steel create ${response.status}: ${text}`);
  return JSON.parse(text);
}

async function releaseSteelSession(id) {
  if (!id) return;
  const response = await fetch(`https://api.steel.dev/v1/sessions/${encodeURIComponent(id)}/release`, {
    method: 'POST',
    headers: { 'steel-api-key': apiKey }
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Steel release ${response.status}: ${await response.text()}`);
  }
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'route';
}

for (const profileName of requestedProfiles) {
  const profile = profiles[profileName];
  if (!profile) throw new Error(`Unknown profile: ${profileName}`);

  let session;
  let browser;
  try {
    session = await createSteelSession();
    const ws = `wss://connect.steel.dev?apiKey=${encodeURIComponent(apiKey)}&sessionId=${encodeURIComponent(session.id)}`;
    browser = await chromium.connectOverCDP(ws);
    const context = browser.contexts()[0];
    const page = context?.pages()[0];
    if (!page) throw new Error('Steel session did not expose an active page.');
    await page.setViewportSize({ width: profile.width, height: profile.height });

    let currentKey = null;
    const consoleErrors = new Map();
    const pageErrors = new Map();
    page.on('console', msg => {
      if (msg.type() !== 'error' || !currentKey) return;
      const list = consoleErrors.get(currentKey) || [];
      list.push(msg.text().slice(0, 1000));
      consoleErrors.set(currentKey, list);
    });
    page.on('pageerror', error => {
      if (!currentKey) return;
      const list = pageErrors.get(currentKey) || [];
      list.push(String(error?.message || error).slice(0, 1000));
      pageErrors.set(currentKey, list);
    });

    for (const target of config.targets || []) {
      const project = target.project || 'project';
      for (const route of target.routes || [{ path: '/' }]) {
        const routePath = route.path || '/';
        const url = new URL(routePath, target.baseUrl).toString();
        currentKey = evidenceKey(project, profileName, routePath);
        consoleErrors.set(currentKey, []);
        pageErrors.set(currentKey, []);

        let navigationError = null;
        let responseStatus = null;
        try {
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: route.timeoutMs || 45000 });
          responseStatus = response?.status() ?? null;
          await page.waitForTimeout(route.settleMs ?? 500);
        } catch (error) {
          navigationError = String(error?.message || error);
        }

        const selectors = route.assertions?.requiredSelectors || [];
        const browserMetrics = navigationError ? null : await page.evaluate((selectorList) => {
          const images = Array.from(document.images);
          const bodyText = document.body?.innerText?.trim() || '';
          const selectorState = Object.fromEntries(selectorList.map(selector => [selector, Boolean(document.querySelector(selector))]));
          const documentWidth = Math.max(
            document.documentElement?.scrollWidth || 0,
            document.body?.scrollWidth || 0
          );
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
        }, selectors);

        const screenshotName = `${safeName(project)}__${safeName(profileName)}__${safeName(routePath)}.png`;
        const screenshotPath = resolve(outDir, screenshotName);
        let screenshotSha256 = null;
        if (!navigationError) {
          await page.screenshot({ path: screenshotPath, fullPage: true });
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
          consoleErrors: consoleErrors.get(currentKey) || [],
          pageErrors: pageErrors.get(currentKey) || [],
          screenshotPath: navigationError ? null : screenshotPath.replace(`${root}/`, ''),
          screenshotSha256
        };

        const assertionFailures = navigationError
          ? [`navigation_error:${navigationError}`]
          : evaluateAssertions(metrics, route.assertions || {});
        if (responseStatus !== null && responseStatus >= 400) assertionFailures.push(`http_status:${responseStatus}`);
        const baselineFailures = compareBaseline(metrics, baseline[currentKey] || {});
        const failures = [...assertionFailures, ...baselineFailures];
        if (failures.length) failed = true;

        results.push({
          key: currentKey,
          project,
          profile: profileName,
          route: routePath,
          testedUrl: url,
          status: failures.length ? 'FAIL' : 'PASS',
          failures,
          metrics
        });
      }
    }
  } finally {
    currentKey = null;
    if (browser) await browser.close().catch(() => {});
    if (session?.id) await releaseSteelSession(session.id).catch(error => {
      failed = true;
      results.push({ key: `session::${profileName}`, status: 'FAIL', failures: [`release_error:${error.message}`] });
    });
  }
}

const report = {
  schemaVersion: 1,
  runId,
  provider: 'steel-cloud',
  config: configPath.replace(`${root}/`, ''),
  generatedAt: new Date().toISOString(),
  summary: {
    total: results.filter(r => r.project).length,
    pass: results.filter(r => r.status === 'PASS' && r.project).length,
    fail: results.filter(r => r.status === 'FAIL' && r.project).length
  },
  results
};
const reportPath = resolve(outDir, 'report.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report.summary, report: reportPath.replace(`${root}/`, '') }, null, 2));
process.exit(failed ? 1 : 0);
