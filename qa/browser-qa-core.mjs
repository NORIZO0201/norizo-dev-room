import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const DEFAULT_PROFILES = {
  pc: { width: 1440, height: 900, isMobile: false },
  sp: { width: 393, height: 852, isMobile: true }
};

export function evaluateAssertions(metrics, assertions = {}) {
  const failures = [];
  if (assertions.hasVisibleContent !== false && !metrics.hasVisibleContent) {
    failures.push('no_visible_content');
  }
  if (assertions.noHorizontalOverflow !== false && metrics.horizontalOverflow) {
    failures.push(`horizontal_overflow:${metrics.documentWidth}>${metrics.viewport.width}`);
  }
  const maxBrokenImages = Number.isFinite(assertions.maxBrokenImages)
    ? assertions.maxBrokenImages
    : 0;
  if (metrics.brokenImages > maxBrokenImages) {
    failures.push(`broken_images:${metrics.brokenImages}>${maxBrokenImages}`);
  }
  const maxConsoleErrors = Number.isFinite(assertions.maxConsoleErrors)
    ? assertions.maxConsoleErrors
    : 0;
  if (metrics.consoleErrors.length > maxConsoleErrors) {
    failures.push(`console_errors:${metrics.consoleErrors.length}>${maxConsoleErrors}`);
  }
  const maxPageErrors = Number.isFinite(assertions.maxPageErrors)
    ? assertions.maxPageErrors
    : 0;
  if (metrics.pageErrors.length > maxPageErrors) {
    failures.push(`page_errors:${metrics.pageErrors.length}>${maxPageErrors}`);
  }
  if (assertions.urlIncludes && !metrics.url.includes(assertions.urlIncludes)) {
    failures.push(`url_missing:${assertions.urlIncludes}`);
  }
  for (const selector of assertions.requiredSelectors || []) {
    if (!metrics.selectors?.[selector]) failures.push(`missing_selector:${selector}`);
  }
  return failures;
}

export function compareBaseline(current, baseline = {}) {
  const failures = [];
  if (baseline.title !== undefined && current.title !== baseline.title) {
    failures.push(`title_changed:${JSON.stringify(baseline.title)}=>${JSON.stringify(current.title)}`);
  }
  if (baseline.screenshotSha256 && current.screenshotSha256 !== baseline.screenshotSha256) {
    failures.push('screenshot_hash_changed');
  }
  if (Number.isFinite(baseline.maxDocumentWidthDelta)) {
    const delta = Math.abs((current.documentWidth || 0) - (baseline.documentWidth || 0));
    if (delta > baseline.maxDocumentWidthDelta) failures.push(`document_width_delta:${delta}`);
  }
  for (const selector of baseline.requiredSelectors || []) {
    if (!current.selectors?.[selector]) failures.push(`baseline_selector_missing:${selector}`);
  }
  return failures;
}

export async function sha256File(path) {
  const bytes = await readFile(path);
  return createHash('sha256').update(bytes).digest('hex');
}

export function evidenceKey(project, profile, route) {
  return `${project}::${profile}::${route}`;
}
