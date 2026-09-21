#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const statePath = resolve(here, '../state/DEV_ROOM_STATE.json');
const state = JSON.parse(await readFile(statePath, 'utf8'));

const expectedOrder = ['P1', 'P2', 'P3', 'P4', 'P5'];
const allowedStatuses = new Set(['pending', 'in_progress', 'complete', 'maintenance']);
const errors = [];

if (state.schema_version !== 1) errors.push('schema_version must be 1');
if (JSON.stringify(state.phase_order) !== JSON.stringify(expectedOrder)) {
  errors.push(`phase_order must be ${expectedOrder.join(' -> ')}`);
}
if (!expectedOrder.includes(state.current_phase)) {
  errors.push('current_phase must be one of P1-P5');
}
if (state.retired_infrastructure?.conoha?.status !== 'retired') {
  errors.push('ConoHa must remain retired');
}
if (state.retired_infrastructure?.conoha?.checked_in_current_model !== false) {
  errors.push('ConoHa must not be checked in the current model');
}
if (state.deployment_policy?.vercel_preview_without_explicit_norizo_request !== false) {
  errors.push('Preview without explicit NORIZO request must remain disabled');
}
if (state.deployment_policy?.production_without_explicit_norizo_approval !== false) {
  errors.push('Production without explicit NORIZO approval must remain disabled');
}

let previousIncomplete = false;
for (const phase of expectedOrder) {
  const record = state.phases?.[phase];
  if (!record) {
    errors.push(`missing phase ${phase}`);
    continue;
  }
  if (!allowedStatuses.has(record.status)) {
    errors.push(`${phase} has invalid status ${record.status}`);
  }
  if (record.status === 'complete' && previousIncomplete) {
    errors.push(`${phase} cannot be complete before an earlier phase`);
  }
  if (!['complete', 'maintenance'].includes(record.status)) previousIncomplete = true;
  if (!record.requirements || typeof record.requirements !== 'object') {
    errors.push(`${phase} requirements must be an object`);
  }
  if (!Array.isArray(record.evidence)) {
    errors.push(`${phase} evidence must be an array`);
  }
}

const result = {
  ok: errors.length === 0,
  current_phase: state.current_phase,
  maintenance_mode: state.maintenance_mode,
  phase_status: Object.fromEntries(expectedOrder.map((p) => [p, state.phases?.[p]?.status ?? 'missing'])),
  retired_infrastructure: ['ConoHa'],
  errors
};

console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
