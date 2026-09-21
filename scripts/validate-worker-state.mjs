#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const ALLOWED_MODES = new Set(['manual', 'scheduled', 'condition_watch', 'batch', 'continuous_external']);
const ALLOWED_HEARTBEATS = new Set(['ready', 'running', 'healthy', 'degraded', 'blocked', 'stopped', 'maintenance']);
const CHECKPOINT_KEYS = new Set([
  'version',
  'sequence',
  'cursor',
  'watermark',
  'last_success_at',
  'input_fingerprint',
  'output_fingerprint'
]);
const HEARTBEAT_KEYS = new Set([
  'status',
  'observed_at',
  'last_success_at',
  'consecutive_failures',
  'run_id',
  'detail'
]);
const SECRET_KEY_PATTERN = /(password|secret|api[_-]?key|service[_-]?role|private[_-]?key|access[_-]?token|refresh[_-]?token)/i;

function isIsoOrNull(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return false;
  return /T/.test(value);
}

function strictKeys(object, allowed, prefix, errors) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return;
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) errors.push(`${prefix}.${key} is not provider-neutral contract state`);
  }
}

function scanSecretKeys(value, path, errors) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key;
    if (SECRET_KEY_PATTERN.test(key)) errors.push(`${next} looks like a secret-bearing field`);
    scanSecretKeys(child, next, errors);
  }
}

export function validateWorkerState(state) {
  const errors = [];
  if (!state || typeof state !== 'object' || Array.isArray(state)) return ['state must be an object'];

  for (const key of ['schema_version', 'project', 'worker', 'execution', 'checkpoint', 'heartbeat', 'safety']) {
    if (!(key in state)) errors.push(`missing ${key}`);
  }
  if (state.schema_version !== 1) errors.push('schema_version must be 1');
  if (typeof state.project !== 'string' || !state.project.trim()) errors.push('project must be a non-empty string');
  if (typeof state.worker !== 'string' || !state.worker.trim()) errors.push('worker must be a non-empty string');

  const execution = state.execution || {};
  if (typeof execution.provider !== 'string' || !execution.provider.trim()) errors.push('execution.provider must be a non-empty string');
  if (/conoha/i.test(String(execution.provider || ''))) errors.push('execution.provider must not bind to retired ConoHa');
  if (!ALLOWED_MODES.has(execution.mode)) errors.push(`execution.mode invalid: ${execution.mode}`);
  if (execution.requires_vps !== false) errors.push('execution.requires_vps must be false');

  const checkpoint = state.checkpoint || {};
  strictKeys(checkpoint, CHECKPOINT_KEYS, 'checkpoint', errors);
  for (const key of CHECKPOINT_KEYS) if (!(key in checkpoint)) errors.push(`missing checkpoint.${key}`);
  if (checkpoint.version !== 1) errors.push('checkpoint.version must be 1');
  if (!Number.isInteger(checkpoint.sequence) || checkpoint.sequence < 0) errors.push('checkpoint.sequence must be a non-negative integer');
  if (!isIsoOrNull(checkpoint.last_success_at)) errors.push('checkpoint.last_success_at must be ISO-8601 or null');

  const heartbeat = state.heartbeat || {};
  strictKeys(heartbeat, HEARTBEAT_KEYS, 'heartbeat', errors);
  for (const key of HEARTBEAT_KEYS) if (!(key in heartbeat)) errors.push(`missing heartbeat.${key}`);
  if (!ALLOWED_HEARTBEATS.has(heartbeat.status)) errors.push(`heartbeat.status invalid: ${heartbeat.status}`);
  if (!isIsoOrNull(heartbeat.observed_at) || heartbeat.observed_at === null) errors.push('heartbeat.observed_at must be ISO-8601');
  if (!isIsoOrNull(heartbeat.last_success_at)) errors.push('heartbeat.last_success_at must be ISO-8601 or null');
  if (!Number.isInteger(heartbeat.consecutive_failures) || heartbeat.consecutive_failures < 0) {
    errors.push('heartbeat.consecutive_failures must be a non-negative integer');
  }
  if (!(heartbeat.run_id === null || typeof heartbeat.run_id === 'string')) errors.push('heartbeat.run_id must be a string or null');
  if (typeof heartbeat.detail !== 'string') errors.push('heartbeat.detail must be a string');

  const safety = state.safety || {};
  if (typeof safety.idempotent !== 'boolean') errors.push('safety.idempotent must be boolean');
  if (safety.conoha_dependency !== false) errors.push('safety.conoha_dependency must be false');
  if (!Array.isArray(safety.allowed_mutations) || safety.allowed_mutations.some(item => typeof item !== 'string')) {
    errors.push('safety.allowed_mutations must be an array of strings');
  }
  if (!(safety.max_side_effects_per_run === null
      || (Number.isInteger(safety.max_side_effects_per_run) && safety.max_side_effects_per_run >= 0))) {
    errors.push('safety.max_side_effects_per_run must be null or a non-negative integer');
  }

  scanSecretKeys(state, '', errors);
  return errors;
}

async function defaultPaths() {
  const dir = resolve(root, 'state/workers');
  const entries = (await readdir(dir, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => resolve(dir, entry.name))
    .sort();
  return entries;
}

async function main() {
  const paths = process.argv.slice(2).map(path => resolve(path));
  const targets = paths.length ? paths : await defaultPaths();
  const results = [];
  let failed = false;

  for (const path of targets) {
    const state = JSON.parse(await readFile(path, 'utf8'));
    const errors = validateWorkerState(state);
    if (errors.length) failed = true;
    results.push({
      path: path.startsWith(root) ? path.slice(root.length + 1) : path,
      project: state.project,
      worker: state.worker,
      ok: errors.length === 0,
      errors
    });
  }

  console.log(JSON.stringify({
    ok: !failed,
    contract: 'contracts/worker-state-contract.json',
    checked: results.length,
    results
  }, null, 2));
  if (failed) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
