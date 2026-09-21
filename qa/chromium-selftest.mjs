#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const temp = await mkdtemp(resolve(tmpdir(), 'norizo-p3-selftest-'));
const outputDir = resolve(temp, 'evidence');
const configPath = resolve(temp, 'config.json');
const html = '<!doctype html><html><head><title>DEV ROOM P3 Fixture</title><meta name="viewport" content="width=device-width"></head><body><main data-qa="main">responsive fixture</main><nav><a href="#ok">ok</a></nav></body></html>';
const config = {
  outputDir,
  runProfiles: ['pc', 'sp'],
  targets: [{
    project: 'p3-selftest',
    baseUrl: 'https://invalid.local',
    routes: [{
      path: '/fixture',
      html,
      assertions: {
        requiredSelectors: ['main[data-qa="main"]'],
        maxConsoleErrors: 0,
        maxPageErrors: 0
      }
    }]
  }]
};
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

try {
  const child = spawnSync(process.execPath, [resolve(here, 'browser-qa-local.mjs'), configPath], {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    timeout: 60000
  });
  if (child.error) throw child.error;
  if (child.status !== 0) {
    throw new Error(`browser QA self-test failed (${child.status})\n${child.stdout}\n${child.stderr}`);
  }

  const report = JSON.parse(await readFile(resolve(outputDir, 'report.json'), 'utf8'));
  assert.equal(report.provider, 'local-chromium-cdp');
  assert.deepEqual(report.summary, { total: 2, pass: 2, fail: 0 });

  const pc = report.results.find(result => result.profile === 'pc');
  const sp = report.results.find(result => result.profile === 'sp');
  assert(pc && sp);
  assert.equal(pc.metrics.viewport.width, 1440);
  assert.equal(sp.metrics.viewport.width, 393);

  for (const result of [pc, sp]) {
    assert.equal(result.status, 'PASS');
    assert.equal(result.metrics.responseStatus, 200);
    assert.equal(result.metrics.horizontalOverflow, false);
    assert.equal(result.metrics.consoleErrors.length, 0);
    assert.equal(result.metrics.pageErrors.length, 0);
    assert.equal(result.metrics.selectors['main[data-qa="main"]'], true);
    assert.match(result.metrics.screenshotSha256, /^[0-9a-f]{64}$/);
    const screenshot = result.metrics.screenshotPath.split('/').pop();
    await access(resolve(outputDir, screenshot), constants.R_OK);
  }

  console.log(JSON.stringify({
    ok: true,
    provider: report.provider,
    checks: [
      'pc_1440x900',
      'sp_393x852',
      'document_load',
      'console_runtime_clean',
      'required_selector',
      'no_horizontal_overflow',
      'screenshots_sha256'
    ]
  }, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}
