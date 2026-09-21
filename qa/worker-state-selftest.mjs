#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorkerState } from '../scripts/validate-worker-state.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const relis = JSON.parse(await readFile(resolve(root, 'state/workers/RELIS.json'), 'utf8'));
const omnw = JSON.parse(await readFile(resolve(root, 'state/workers/OMNW_DISCOVERY.json'), 'utf8'));

assert.deepEqual(validateWorkerState(relis), []);
assert.deepEqual(validateWorkerState(omnw), []);
assert.deepEqual(Object.keys(relis.checkpoint).sort(), Object.keys(omnw.checkpoint).sort());
assert.deepEqual(Object.keys(relis.heartbeat).sort(), Object.keys(omnw.heartbeat).sort());
assert.equal(relis.execution.requires_vps, false);
assert.equal(omnw.execution.requires_vps, false);
assert.equal(relis.safety.conoha_dependency, false);
assert.equal(omnw.safety.conoha_dependency, false);

const invalid = structuredClone(relis);
invalid.execution.provider = 'retired-conoha-vps';
invalid.execution.requires_vps = true;
invalid.safety.conoha_dependency = true;
invalid.checkpoint.vercel_deployment_id = 'provider-specific';
invalid.service_role_key = 'must-never-appear';
const failures = validateWorkerState(invalid);
assert(failures.some(item => item.includes('retired ConoHa')));
assert(failures.includes('execution.requires_vps must be false'));
assert(failures.includes('safety.conoha_dependency must be false'));
assert(failures.some(item => item.includes('checkpoint.vercel_deployment_id')));
assert(failures.some(item => item.includes('service_role_key')));

console.log(JSON.stringify({
  ok: true,
  contract: 'contracts/worker-state-contract.json',
  reusable_projects: ['RELIS', 'OMNW'],
  checkpoint_shape_shared: true,
  heartbeat_shape_shared: true,
  vps_dependency_rejected: true,
  provider_specific_checkpoint_rejected: true,
  secret_fields_rejected: true
}, null, 2));
