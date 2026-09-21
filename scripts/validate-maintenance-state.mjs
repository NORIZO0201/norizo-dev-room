#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const sha40 = /^[0-9a-f]{40}$/;

export function validateMaintenance({ contract, state, handoff, observation }) {
  const errors = [];

  if (contract?.schema_version !== 1 || contract?.mode !== 'maintenance') {
    errors.push('invalid maintenance contract identity');
  }
  if (contract?.foundation_phase !== 'P5') errors.push('maintenance foundation must be P5');
  if (contract?.policy?.conoha_retired !== true) errors.push('maintenance contract must retire ConoHa');
  if (contract?.policy?.vercel_preview_requires_explicit_norizo_request !== true) {
    errors.push('maintenance contract must require explicit NORIZO request for Preview');
  }
  if (contract?.policy?.production_deploy_requires_explicit_norizo_approval !== true) {
    errors.push('maintenance contract must require explicit NORIZO approval for Production');
  }
  if (contract?.policy?.retired_omnw_harvest_must_remain_absent !== true) {
    errors.push('maintenance contract must keep retired OMNW Harvest absent');
  }

  if (state?.current_phase !== 'P5' || state?.maintenance_mode !== true) {
    errors.push('canonical state must remain P5 maintenance');
  }
  if (state?.retired_infrastructure?.conoha?.status !== 'retired') errors.push('ConoHa must remain retired');
  if (state?.retired_infrastructure?.conoha?.rule !== 'do_not_check_start_rebuild_or_recreate') {
    errors.push('ConoHa retirement rule drifted');
  }
  if (state?.deployment_policy?.vercel_preview_without_explicit_norizo_request !== false) {
    errors.push('canonical state must forbid unrequested Preview');
  }
  if (state?.deployment_policy?.production_without_explicit_norizo_approval !== false) {
    errors.push('canonical state must forbid unapproved Production');
  }

  const requiredPhases = contract?.requires_completed_phases || [];
  for (const phase of requiredPhases) {
    if (state?.phases?.[phase]?.status !== 'complete') errors.push(`${phase} must remain complete in maintenance`);
  }

  if (handoff?.foundation_status !== 'PASS' || handoff?.next_mode !== 'maintenance') {
    errors.push('P5 handoff must remain PASS in maintenance mode');
  }
  if (handoff?.deployment_policy?.preview_without_explicit_norizo_request !== false) {
    errors.push('P5 handoff must forbid unrequested Preview');
  }
  if (handoff?.deployment_policy?.production_without_explicit_norizo_approval !== false) {
    errors.push('P5 handoff must forbid unapproved Production');
  }

  if (observation?.schema_version !== 1 || observation?.mode !== 'maintenance') {
    errors.push('invalid maintenance observation identity');
  }
  if (observation?.foundation_status !== 'PASS') errors.push('maintenance observation foundation_status must be PASS');
  if (observation?.operations?.conoha_touched !== false) errors.push('maintenance observation must prove ConoHa untouched');
  if (observation?.operations?.preview_deploy_created_by_this_run !== false) {
    errors.push('maintenance observation must prove no Preview created by this run');
  }
  if (observation?.operations?.production_deploy_created_by_this_run !== false) {
    errors.push('maintenance observation must prove no Production created by this run');
  }
  if (observation?.operations?.allowlisted_only !== true) errors.push('maintenance operations must remain allowlisted');

  const tracked = contract?.tracked_projects || [];
  for (const id of tracked) {
    const project = observation?.projects?.[id];
    if (!project) {
      errors.push(`maintenance observation missing ${id}`);
      continue;
    }
    if (!sha40.test(project.github_main_sha || '')) errors.push(`${id} requires a 40-char GitHub main SHA`);
    if (project.supabase_status !== 'ACTIVE_HEALTHY') errors.push(`${id} Supabase must be ACTIVE_HEALTHY`);
    if (!Number.isInteger(project.vercel_runtime_errors_1h) || project.vercel_runtime_errors_1h < 0) {
      errors.push(`${id} requires a non-negative integer Vercel runtime error count`);
    }
    if (!project.deployment_boundary) errors.push(`${id} requires an explicit deployment boundary`);
  }

  const omnw = observation?.omnw_boundary_audit;
  if (omnw?.harvest_surfaces !== 0) errors.push('retired OMNW Harvest surface detected');
  if (omnw?.consumer_discovery_foreign_keys !== 0) errors.push('OMNW Consumer directly depends on Discovery');
  if (omnw?.recognition_image_index_exists !== true) errors.push('OMNW recognition_image_index sidecar missing');
  if (omnw?.retired_harvest_absent !== true) errors.push('retired OMNW Harvest absence not proven');
  if (omnw?.discovery_consumer_separate !== true) errors.push('OMNW Discovery/Consumer separation not proven');

  const consumerSha = observation?.projects?.OMNW?.consumer_branch_sha;
  if (!sha40.test(consumerSha || '')) errors.push('OMNW Consumer branch requires a 40-char SHA');
  const requiredConsumerMilestone = contract?.required_observation?.omnw_consumer_milestone;
  if (!/^M[0-4]$/.test(requiredConsumerMilestone || '')) {
    errors.push('maintenance contract requires an explicit OMNW Consumer milestone M0-M4');
  } else if (observation?.projects?.OMNW?.consumer_milestone_observed !== requiredConsumerMilestone) {
    errors.push(`OMNW Consumer milestone observation must be ${requiredConsumerMilestone}`);
  }

  if (observation?.public_evidence?.nihonwine_jp_homepage_observed !== true) {
    errors.push('maintenance observation requires at least one public homepage evidence point');
  }

  return errors;
}

async function main() {
  const [contract, state, handoff, observation] = await Promise.all([
    readFile(resolve(root, 'contracts/maintenance-mode.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'state/DEV_ROOM_STATE.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'state/P5_HANDOFF.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'state/MAINTENANCE_OBSERVATION.json'), 'utf8').then(JSON.parse)
  ]);

  const errors = validateMaintenance({ contract, state, handoff, observation });
  console.log(JSON.stringify({
    ok: errors.length === 0,
    mode: 'maintenance',
    observed_at: observation.observed_at,
    foundation_status: observation.foundation_status,
    errors
  }, null, 2));
  if (errors.length) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
