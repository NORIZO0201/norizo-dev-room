#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMaintenance } from '../scripts/validate-maintenance-state.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const [contract, state, handoff, observation] = await Promise.all([
  readFile(resolve(root, 'contracts/maintenance-mode.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'state/DEV_ROOM_STATE.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'state/P5_HANDOFF.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'state/MAINTENANCE_OBSERVATION.json'), 'utf8').then(JSON.parse)
]);

assert.deepEqual(validateMaintenance({ contract, state, handoff, observation }), []);

const broken = structuredClone({ contract, state, handoff, observation });
broken.state.maintenance_mode = false;
broken.observation.operations.conoha_touched = true;
broken.observation.projects.OMNW.supabase_status = 'UNKNOWN';
broken.observation.omnw_boundary_audit.harvest_surfaces = 1;
broken.observation.operations.production_deploy_created_by_this_run = true;
const failures = validateMaintenance(broken);

assert(failures.includes('canonical state must remain P5 maintenance'));
assert(failures.includes('maintenance observation must prove ConoHa untouched'));
assert(failures.includes('OMNW Supabase must be ACTIVE_HEALTHY'));
assert(failures.includes('retired OMNW Harvest surface detected'));
assert(failures.includes('maintenance observation must prove no Production created by this run'));

console.log(JSON.stringify({
  ok: true,
  mode: 'maintenance',
  p1_p5_completion_guard: true,
  conoha_retirement_guard: true,
  preview_production_boundary_guard: true,
  omnw_harvest_guard: true,
  cross_project_health_guard: true
}, null, 2));
