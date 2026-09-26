#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

// Regression guard for the 2026-09-26 web-dev-closed-loop-audit repair (Issue #34):
// AGENTS.md must never assert a cross-repo canonical file as already merged, or a
// repository label as already applied, ahead of verified evidence.
export function validateWebDevLaneRefs(agentsMd) {
  const errors = [];

  const laneMatch = agentsMd.match(/### web-dev lane[\s\S]*?(?=\n## |\n### |$)/);
  if (!laneMatch) {
    errors.push('AGENTS.md is missing the "web-dev lane" section');
    return errors;
  }
  const lane = laneMatch[0];

  if (/so web-dev Issues here carry both labels/.test(lane)) {
    errors.push('AGENTS.md must not claim web-dev Issues already carry the `web-dev` label (not yet created)');
  }
  if (!/`web-dev` has not been created as a repository label/.test(lane) && !/web-dev.*label.*not yet/i.test(lane)) {
    errors.push('AGENTS.md must record that the `web-dev` label does not yet exist here');
  }
  if (!/`dev-order`.*(only label proven|proven to exist|remains the live)/i.test(lane)) {
    errors.push('AGENTS.md must state that `dev-order` is the proven live trigger label');
  }

  if (/config\/web_dev\.yaml/.test(lane)) {
    const pendingBlock = lane.match(/PENDING[\s\S]{0,600}config\/web_dev\.yaml[\s\S]{0,600}|config\/web_dev\.yaml[\s\S]{0,600}PENDING[\s\S]{0,600}/);
    if (!pendingBlock) {
      errors.push('AGENTS.md references config/web_dev.yaml but does not mark it PENDING (it is not yet on orchestrator main)');
    }
    if (!/orchestrator PR #9/.test(lane)) {
      errors.push('AGENTS.md must cite orchestrator PR #9 as the pending source of config/web_dev.yaml');
    }
  }

  return errors;
}

async function main() {
  const agentsMd = await readFile(resolve(root, 'AGENTS.md'), 'utf8');
  const errors = validateWebDevLaneRefs(agentsMd);
  console.log(JSON.stringify({ ok: errors.length === 0, check: 'web-dev-lane-refs', errors }, null, 2));
  if (errors.length) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
