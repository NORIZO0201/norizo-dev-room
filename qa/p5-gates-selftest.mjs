#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateP5 } from '../scripts/validate-p5-gates.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const [contract, handoff, state] = await Promise.all([
  readFile(resolve(root, 'contracts/p5-project-gates.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'state/P5_HANDOFF.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'state/DEV_ROOM_STATE.json'), 'utf8').then(JSON.parse)
]);

assert.deepEqual(validateP5({ contract, handoff, state }), []);

const broken = structuredClone({ contract, handoff, state });
broken.contract.projects.find(project => project.id === 'CNW').gate_status = 'FAIL';
broken.handoff.deployment_policy.production_without_explicit_norizo_approval = true;
broken.handoff.projects.OMNW.boundary.retired_harvest_absent = false;
broken.handoff.projects.SAYAKA.supabase.status = 'UNKNOWN';
const failures = validateP5(broken);
assert(failures.includes('CNW gate must be PASS'));
assert(failures.includes('handoff must forbid unapproved Production'));
assert(failures.includes('retired OMNW Harvest must remain absent'));
assert(failures.includes('SAYAKA Supabase must be ACTIVE_HEALTHY at handoff observation'));

console.log(JSON.stringify({
  ok: true,
  phase: 'P5',
  required_gates: ['SAYAKA', 'CNW', 'OMNW'],
  other_disposition: 'PASS-NOT-REQUIRED',
  handoff_state: true,
  production_approval_boundary_enforced: true,
  retired_harvest_guard_enforced: true,
  maintenance_transition: true
}, null, 2));
