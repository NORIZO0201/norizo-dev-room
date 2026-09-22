#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

export function validateP5({ contract, handoff, state }) {
  const errors = [];
  const requiredIds = ['SAYAKA', 'CNW', 'OMNW'];

  if (contract?.schema_version !== 1 || contract?.phase !== 'P5') errors.push('invalid P5 contract identity');
  if (contract?.scope !== 'development_foundation') errors.push('P5 scope must be development_foundation');
  if (contract?.policy?.conoha_dependency !== false) errors.push('P5 must not depend on ConoHa');
  if (contract?.policy?.vercel_preview_requires_explicit_norizo_request !== false || contract?.policy?.preview_is_default_development_surface !== true) {
    errors.push('Preview must be the default development surface');
  }
  if (contract?.policy?.production_deploy_requires_explicit_norizo_approval !== true) {
    errors.push('Production must require explicit NORIZO approval');
  }

  const projects = Array.isArray(contract?.projects) ? contract.projects : [];
  const byId = new Map(projects.map(project => [project.id, project]));
  if (byId.size !== projects.length) errors.push('project IDs must be unique');

  for (const id of requiredIds) {
    const project = byId.get(id);
    if (!project) {
      errors.push(`missing required gate ${id}`);
      continue;
    }
    if (project.required !== true) errors.push(`${id} must be required`);
    if (project.gate_status !== 'PASS') errors.push(`${id} gate must be PASS`);
    if (!Array.isArray(project.deterministic_commands) || project.deterministic_commands.length === 0) {
      errors.push(`${id} must declare deterministic commands`);
    }
    if (project.browser_qa?.contract !== 'P3' || project.browser_qa?.required !== true) {
      errors.push(`${id} must consume the P3 browser QA contract`);
    }
    const profiles = project.browser_qa?.profiles || [];
    if (!profiles.includes('pc') || !profiles.includes('sp')) errors.push(`${id} must require pc and sp QA`);
    if (!Array.isArray(project.proof) || project.proof.length === 0) errors.push(`${id} must declare proof`);
  }

  const other = projects.find(project => !requiredIds.includes(project.id));
  if (!other) {
    errors.push('missing explicit other-project disposition');
  } else if (!['PASS', 'PASS-NOT-REQUIRED'].includes(other.gate_status)) {
    errors.push('other project must PASS or be PASS-NOT-REQUIRED');
  } else if (other.gate_status === 'PASS-NOT-REQUIRED' && (!Array.isArray(other.proof) || other.proof.length === 0)) {
    errors.push('PASS-NOT-REQUIRED requires rationale/proof');
  }

  if (handoff?.schema_version !== 1 || handoff?.phase !== 'P5') errors.push('invalid P5 handoff identity');
  if (handoff?.foundation_status !== 'PASS') errors.push('handoff foundation_status must be PASS');
  if (handoff?.deployment_policy?.preview_without_explicit_norizo_request !== true || handoff?.deployment_policy?.preview_is_default_development_surface !== true) {
    errors.push('handoff must enable Preview-first development');
  }
  if (handoff?.deployment_policy?.production_without_explicit_norizo_approval !== false) {
    errors.push('handoff must forbid unapproved Production');
  }
  if (handoff?.next_mode !== 'maintenance') errors.push('P5 handoff must transition to maintenance');

  for (const id of requiredIds) {
    const project = handoff?.projects?.[id];
    if (!project) {
      errors.push(`handoff missing ${id}`);
      continue;
    }
    if (project.gate_status !== 'PASS') errors.push(`handoff ${id} gate must be PASS`);
    if (!/^[0-9a-f]{40}$/.test(project.source?.main_sha || '')) errors.push(`${id} handoff requires a main SHA`);
    if (project.supabase?.status !== 'ACTIVE_HEALTHY') errors.push(`${id} Supabase must be ACTIVE_HEALTHY at handoff observation`);
    const action = project.handoff?.production_action;
    if (!action || /AUTO_DEPLOY|AUTO_PROMOTE|DEPLOY_NOW/.test(action)) errors.push(`${id} production handoff violates approval boundary`);
  }

  const omnw = handoff?.projects?.OMNW;
  if (omnw?.boundary?.discovery_consumer_separate !== true) errors.push('OMNW Discovery/Consumer boundary must remain separate');
  if (omnw?.boundary?.retired_harvest_absent !== true) errors.push('retired OMNW Harvest must remain absent');
  if (omnw?.boundary?.consumer_m0_m4_development_allowed !== true) errors.push('OMNW Consumer M0-M4 development boundary missing');

  if (!handoff?.projects?.OTHER_NIHON_WINE_JP) errors.push('handoff missing observed other project');

  if (!state?.phases?.P1 || !state?.phases?.P2 || !state?.phases?.P3 || !state?.phases?.P4 || !state?.phases?.P5) {
    errors.push('canonical phase state incomplete');
  } else {
    for (const phase of ['P1', 'P2', 'P3', 'P4']) {
      if (state.phases[phase].status !== 'complete') errors.push(`${phase} must be complete before P5`);
    }
    if (!['in_progress', 'complete', 'maintenance'].includes(state.phases.P5.status)) {
      errors.push('P5 state must be in_progress, complete, or maintenance');
    }
  }

  return errors;
}

async function main() {
  const [contract, handoff, state] = await Promise.all([
    readFile(resolve(root, 'contracts/p5-project-gates.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'state/P5_HANDOFF.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'state/DEV_ROOM_STATE.json'), 'utf8').then(JSON.parse)
  ]);
  const errors = validateP5({ contract, handoff, state });
  console.log(JSON.stringify({
    ok: errors.length === 0,
    phase: 'P5',
    foundation_status: handoff.foundation_status,
    next_mode: handoff.next_mode,
    project_status: Object.fromEntries(contract.projects.map(project => [project.id, project.gate_status])),
    errors
  }, null, 2));
  if (errors.length) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
