#!/usr/bin/env node
// Runs only on a macOS host with Xcode installed. Drives the real Apple iOS
// Simulator (Mobile Safari) via `xcrun simctl`, never viewport emulation.
import { buildIosSimulatorLaunch } from '../../api/native-host-core.mjs';
import { startAgentServer, runCommand } from './_agent-server.mjs';

const udid = process.env.IOS_SIMULATOR_UDID;
if (!udid) {
  console.error('IOS_SIMULATOR_UDID is required (see `xcrun simctl list devices`).');
  process.exit(1);
}

let lastNavigationResult = null;
let lastUrl = null;
let lastEvidenceAt = null;

async function probeHealth() {
  try {
    const listing = await runCommand('xcrun', ['simctl', 'list', 'devices', '-j']);
    const devices = JSON.parse(listing).devices;
    const found = Object.values(devices).flat().find((d) => d.udid === udid);
    if (!found) return { status: 'error', error: `SIMULATOR_UDID_NOT_FOUND:${udid}` };
    if (found.state !== 'Booted') return { status: 'error', error: `SIMULATOR_NOT_BOOTED:${found.state}` };
    return {
      status: 'ok',
      runtime: found.deviceTypeIdentifier || 'iOS Simulator',
      url: lastUrl,
      lastNavigationResult,
      evidenceAt: lastEvidenceAt || Date.now()
    };
  } catch (e) {
    return { status: 'error', error: e?.message || String(e) };
  }
}

function buildLaunch(url) {
  const launch = buildIosSimulatorLaunch({ udid, url });
  lastUrl = url;
  lastNavigationResult = 'REQUESTED';
  lastEvidenceAt = Date.now();
  return launch;
}

const port = Number(process.env.PORT || 8787);
startAgentServer({ token: process.env.NATIVE_HOST_TOKEN, buildLaunch, probeHealth, port });
console.log(`iOS native host agent listening on :${port} (udid=${udid})`);
