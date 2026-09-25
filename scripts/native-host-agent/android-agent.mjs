#!/usr/bin/env node
// Runs only on a host with the Android SDK and a booted AVD. Drives the real
// Android Emulator (Chrome for Android) via `adb`, never desktop Chromium
// mobile emulation.
import { buildAndroidChromeLaunch } from '../../api/native-host-core.mjs';
import { startAgentServer, runCommand } from './_agent-server.mjs';

const serial = process.env.ANDROID_SERIAL;
if (!serial) {
  console.error('ANDROID_SERIAL is required (see `adb devices`).');
  process.exit(1);
}

let lastNavigationResult = null;
let lastUrl = null;
let lastEvidenceAt = null;

async function probeHealth() {
  try {
    const devices = await runCommand('adb', ['devices']);
    const line = devices.split('\n').find((l) => l.startsWith(serial));
    if (!line) return { status: 'error', error: `ADB_SERIAL_NOT_FOUND:${serial}` };
    if (!line.includes('device')) return { status: 'error', error: `ADB_DEVICE_NOT_READY:${line.trim()}` };
    const model = await runCommand('adb', ['-s', serial, 'shell', 'getprop', 'ro.product.model']).catch(() => 'Android Emulator');
    return {
      status: 'ok',
      runtime: model || 'Android Emulator',
      url: lastUrl,
      lastNavigationResult,
      evidenceAt: lastEvidenceAt || Date.now()
    };
  } catch (e) {
    return { status: 'error', error: e?.message || String(e) };
  }
}

function buildLaunch(url) {
  const launch = buildAndroidChromeLaunch({ serial, url });
  lastUrl = url;
  lastNavigationResult = 'REQUESTED';
  lastEvidenceAt = Date.now();
  return launch;
}

const port = Number(process.env.PORT || 8788);
startAgentServer({ token: process.env.NATIVE_HOST_TOKEN, buildLaunch, probeHealth, port });
console.log(`Android native host agent listening on :${port} (serial=${serial})`);
