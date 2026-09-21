#!/usr/bin/env node
import assert from 'node:assert/strict';
import { DEFAULT_PROFILES, compareBaseline, evaluateAssertions, evidenceKey } from './browser-qa-core.mjs';

assert.deepEqual(DEFAULT_PROFILES.pc, { width: 1440, height: 900, isMobile: false });
assert.deepEqual(DEFAULT_PROFILES.sp, { width: 393, height: 852, isMobile: true });
assert.equal(evidenceKey('OMNW', 'sp', '/capture'), 'OMNW::sp::/capture');

const healthy = {
  url: 'https://example.com/',
  title: 'Example Domain',
  hasVisibleContent: true,
  horizontalOverflow: false,
  documentWidth: 393,
  viewport: { width: 393, height: 852, dpr: 1 },
  brokenImages: 0,
  consoleErrors: [],
  pageErrors: [],
  selectors: { body: true, main: true },
  screenshotSha256: 'abc123'
};

assert.deepEqual(evaluateAssertions(healthy, {
  requiredSelectors: ['body', 'main'],
  urlIncludes: 'example.com'
}), []);

assert.deepEqual(compareBaseline(healthy, {
  title: 'Example Domain',
  screenshotSha256: 'abc123',
  documentWidth: 393,
  maxDocumentWidthDelta: 0,
  requiredSelectors: ['main']
}), []);

const failures = evaluateAssertions({
  ...healthy,
  horizontalOverflow: true,
  documentWidth: 500,
  brokenImages: 1,
  consoleErrors: ['boom'],
  pageErrors: ['crash'],
  selectors: { body: false }
}, { requiredSelectors: ['body'] });

assert(failures.some(item => item.startsWith('horizontal_overflow:')));
assert(failures.includes('broken_images:1>0'));
assert(failures.includes('console_errors:1>0'));
assert(failures.includes('page_errors:1>0'));
assert(failures.includes('missing_selector:body'));

const regressionFailures = compareBaseline(healthy, {
  title: 'Changed Title',
  screenshotSha256: 'different'
});
assert(regressionFailures.includes('title_changed:"Changed Title"=>"Example Domain"'));
assert(regressionFailures.includes('screenshot_hash_changed'));

console.log(JSON.stringify({
  ok: true,
  profiles: Object.keys(DEFAULT_PROFILES),
  checks: [
    'responsive_pc_sp_profiles',
    'navigation_url_assertion',
    'horizontal_overflow',
    'broken_images',
    'console_errors',
    'page_errors',
    'required_selectors',
    'screenshot_hash_regression',
    'title_regression'
  ]
}, null, 2));
