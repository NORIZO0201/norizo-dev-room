// Shared minimal HTTP server for the iOS/Android native host agents.
// Runs only on the real macOS/Android host machine — never in Vercel or CI.
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function runCommand(bin, args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr?.toString().trim() || error.message));
      resolve(stdout?.toString().trim() || '');
    });
  });
}

// state.probeHealth() -> { status:'ok', runtime, url, lastNavigationResult, evidenceAt } | { status:'error', error }
// state.buildLaunch(url) -> { bin, args } (from api/native-host-core.mjs)
export function startAgentServer({ token, buildLaunch, probeHealth, port = 8787 }) {
  const server = createServer(async (req, res) => {
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (token) {
      const auth = req.headers.authorization || '';
      if (auth !== `Bearer ${token}`) return send(401, { status: 'error', error: 'UNAUTHORIZED' });
    }
    try {
      if (req.method === 'GET' && req.url === '/health') {
        return send(200, await probeHealth());
      }
      if (req.method === 'POST' && req.url === '/navigate') {
        const { url } = await readJsonBody(req);
        const { bin, args } = buildLaunch(url);
        await runCommand(bin, args);
        return send(200, { ok: true, url });
      }
      return send(404, { status: 'error', error: 'NOT_FOUND' });
    } catch (e) {
      return send(500, { status: 'error', error: e?.message || String(e) });
    }
  });
  server.listen(port);
  return server;
}

export { runCommand };
