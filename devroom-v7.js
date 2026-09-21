// NORIZO DEV ROOM — device runtime.
// This file drives the existing UI. It does not create, remove or restyle any
// element: it only fills the panes that index.html already defines.

let current = null, endAt = 0, tick = null, renewing = false;
const enabled = { iphone: true, android: true, pc: false };
const devices = ['iphone', 'android', 'pc'];
const MOBILE = ['iphone', 'android'];
const FALLBACK_VIEWPORT = { iphone: { width: 393, height: 852 }, android: { width: 412, height: 915 } };
const OMNW_QA = 'https://oh-my-nihon-wine-git-dev-room-qa-oh-my-nihon-wine.vercel.app';
const PREVIEW_DEFAULTS = { 'https://oh-my-nihon-wine.jp': OMNW_QA };
let activeTarget = 'production';

// Snapshot cadence. One request at a time per device (see pumpSnapshot), so the
// real rate is self-limiting: ~1.1 req/s per mobile device at best, less when
// the provider is slow. That keeps two live devices comfortably under any
// per-second budget on Vercel and on the browser provider.
const SNAP_INTERVAL_MS = 850;
const SNAP_HIDDEN_MS = 2000;
const SNAP_TIMEOUT_MS = 20000;
const SNAP_BACKOFF_MS = 900;
const SNAP_BACKOFF_MAX_MS = 8000;
const SCROLL_FLUSH_MS = 120;

const $ = s => document.querySelector(s);
const cap = d => d.charAt(0).toUpperCase() + d.slice(1);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function setLog(s, bad = false) { $('#log').textContent = s; $('#status').textContent = bad ? 'ERROR' : s; }
function viewerUrl(u) { if (!u) return 'about:blank'; const sep = u.includes('?') ? '&' : '?'; return u + sep + 'interactive=true&showControls=true'; }
function busy(device, text) { const el = $('#' + device + 'Busy'); if (el) { el.textContent = text; el.classList.add('show'); } }
function clearBusy(device) { const el = $('#' + device + 'Busy'); if (el) el.classList.remove('show'); }
function activeDevices() { return devices.filter(d => enabled[d]); }

/* ---------------------------------------------------------------- snapshots */
// One in-flight request per device at all times. The image is fetched as a blob
// and handed to the existing <img> as an object URL, so a frame is only swapped
// in once it has fully arrived and decoded — never a half-loaded src.
const snapState = {};
function snap(d) {
  if (!snapState[d]) snapState[d] = { timer: null, controller: null, inFlight: false, fails: 0, live: false, objectUrl: null };
  return snapState[d];
}

function stopSnapshots() {
  for (const d of MOBILE) {
    const s = snap(d);
    if (s.timer) clearTimeout(s.timer);
    s.timer = null;
    if (s.controller) s.controller.abort();
    s.controller = null;
    s.inFlight = false;
    s.fails = 0;
    s.live = false;
    if (s.objectUrl) { URL.revokeObjectURL(s.objectUrl); s.objectUrl = null; }
  }
}

function startSnapshots() {
  stopSnapshots();
  for (const d of MOBILE) if (enabled[d] && current?.sessions?.[d]?.id) pumpSnapshot(d);
}

function scheduleSnapshot(d, delay) {
  const s = snap(d);
  if (s.timer) clearTimeout(s.timer);
  s.timer = setTimeout(() => pumpSnapshot(d), delay);
}

async function pumpSnapshot(d) {
  const s = snap(d);
  if (s.timer) { clearTimeout(s.timer); s.timer = null; }
  if (!current || !enabled[d] || s.inFlight) return;

  const session = current.sessions?.[d];
  if (!session?.id) return;

  // Nothing to look at while the tab is hidden — poll slowly just to notice
  // when the session dies, and pay no snapshot cost meanwhile.
  if (document.hidden) return scheduleSnapshot(d, SNAP_HIDDEN_MS);

  s.inFlight = true;
  const controller = new AbortController();
  s.controller = controller;
  const timeout = setTimeout(() => controller.abort(), SNAP_TIMEOUT_MS);

  try {
    const r = await fetch('/api/snapshot?id=' + encodeURIComponent(session.id) + '&device=' + d + '&t=' + Date.now(),
      { cache: 'no-store', signal: controller.signal });

    if (!r.ok) {
      const header = r.headers.get('x-devroom-error');
      const detail = header ? decodeURIComponent(header) : (await r.text().catch(() => '')).slice(0, 200);
      throw new Error(detail || ('snapshot ' + r.status));
    }

    const blob = await r.blob();
    if (!blob.size) throw new Error('empty snapshot');

    const img = $('#' + d);
    const url = URL.createObjectURL(blob);
    const previous = s.objectUrl;
    s.objectUrl = url;
    img.src = url;
    if (img.decode) await img.decode().catch(() => {});
    if (previous) URL.revokeObjectURL(previous);

    s.fails = 0;
    if (!s.live) { s.live = true; onDeviceLive(d); }
    scheduleSnapshot(d, SNAP_INTERVAL_MS);
  } catch (e) {
    // The pane was torn down (stop/renew) while this request was in flight —
    // do not schedule a retry against a session that no longer exists.
    if (!current || !enabled[d]) return;
    s.fails += 1;
    if (s.fails === 3) {
      $('#' + d + 'State').textContent = 'RECONNECTING';
      setLog(d + ' snapshot: ' + (e?.message || e), true);
    }
    scheduleSnapshot(d, Math.min(SNAP_BACKOFF_MS * Math.pow(2, Math.min(s.fails, 4)), SNAP_BACKOFF_MAX_MS));
  } finally {
    clearTimeout(timeout);
    s.inFlight = false;
    if (s.controller === controller) s.controller = null;
  }
}

// A pane only claims LIVE once a real frame has actually been painted.
function onDeviceLive(d) {
  $('#' + d + 'Empty').style.display = 'none';
  $('#' + d + 'State').textContent = 'LIVE';
  clearBusy(d);
}

document.addEventListener('visibilitychange', () => {
  if (!current) return;
  if (document.hidden) return;
  for (const d of MOBILE) if (enabled[d]) pumpSnapshot(d);
});

/* ------------------------------------------------------- gesture forwarding */
// The snapshot is drawn with `object-fit: contain`, so the image occupies only
// part of the <img> box and is letterboxed on one axis. Mapping a click needs
// the real drawn rectangle, not the element box.
function drawnRect(img) {
  const box = img.getBoundingClientRect();
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!box.width || !box.height || !nw || !nh) return null;
  const scale = Math.min(box.width / nw, box.height / nh);
  const width = nw * scale, height = nh * scale;
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height
  };
}

function deviceViewport(d) {
  return current?.sessions?.[d]?.viewport || FALLBACK_VIEWPORT[d] || FALLBACK_VIEWPORT.iphone;
}

// Display point -> device CSS pixel. Returns null for clicks that land on the
// letterbox rather than on the page.
function toViewportPoint(d, clientX, clientY) {
  const img = $('#' + d);
  const rect = drawnRect(img);
  if (!rect) return null;
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  if (px < 0 || py < 0 || px > rect.width || py > rect.height) return null;
  const vp = deviceViewport(d);
  return {
    x: clamp(px / rect.width * vp.width, 0, vp.width - 1),
    y: clamp(py / rect.height * vp.height, 0, vp.height - 1)
  };
}

// Display-space delta -> device CSS pixel delta.
function toViewportDeltaY(d, dy) {
  const rect = drawnRect($('#' + d));
  if (!rect) return dy;
  return dy * deviceViewport(d).height / rect.height;
}

// Wheel deltas arrive in lines or pages on some platforms; normalise to pixels
// so the remote wheel event scrolls by the same amount everywhere.
function wheelPixels(e) {
  let dx = e.deltaX, dy = e.deltaY;
  if (e.deltaMode === 1) { dx *= 16; dy *= 16; }
  else if (e.deltaMode === 2) { dx *= window.innerWidth; dy *= window.innerHeight; }
  return { dx, dy };
}

async function deviceAction(device, type, payload = {}) {
  const session = current?.sessions?.[device];
  if (!session?.id) return null;
  try {
    const j = await api('/api/device-action', { id: session.id, device, type, ...payload });
    pumpSnapshot(device);
    return j;
  } catch (e) {
    setLog(e.message, true);
    return null;
  }
}

// Wheel and touch-drag fire far faster than the provider can accept requests,
// so deltas are accumulated and flushed on a short timer instead of sending one
// request per event.
const scrollQueue = {};
function queueScroll(d, deltaY) {
  if (!Number.isFinite(deltaY) || !deltaY) return;
  const q = scrollQueue[d] || (scrollQueue[d] = { delta: 0, timer: null, sending: false });
  q.delta += deltaY;
  if (q.timer || q.sending) return;
  q.timer = setTimeout(() => flushScroll(d), SCROLL_FLUSH_MS);
}

async function flushScroll(d) {
  const q = scrollQueue[d];
  if (!q) return;
  q.timer = null;
  const delta = Math.round(q.delta);
  q.delta = 0;
  if (!delta) return;
  q.sending = true;
  try {
    await deviceAction(d, 'scroll', { deltaY: delta });
  } finally {
    q.sending = false;
    if (q.delta) q.timer = setTimeout(() => flushScroll(d), SCROLL_FLUSH_MS);
  }
}

function bindDeviceInput(d) {
  const img = $('#' + d);
  let touchY = null;

  img.addEventListener('click', e => {
    if (!current) return;
    const point = toViewportPoint(d, e.clientX, e.clientY);
    if (!point) return;
    deviceAction(d, 'tap', { x: Math.round(point.x), y: Math.round(point.y) });
  });

  img.addEventListener('wheel', e => {
    if (!current) return;
    e.preventDefault();
    queueScroll(d, toViewportDeltaY(d, wheelPixels(e).dy));
  }, { passive: false });

  img.addEventListener('touchstart', e => { touchY = e.touches[0]?.clientY ?? null; }, { passive: true });
  img.addEventListener('touchmove', e => {
    if (touchY === null || !current) return;
    const y = e.touches[0]?.clientY;
    if (y == null) return;
    queueScroll(d, toViewportDeltaY(d, touchY - y));
    touchY = y;
  }, { passive: true });
  img.addEventListener('touchend', () => { touchY = null; }, { passive: true });
  img.addEventListener('touchcancel', () => { touchY = null; }, { passive: true });
}

/* ------------------------------------------------------------ session state */
function updateLayout() {
  const active = activeDevices();
  $('#deviceArea').className = 'deviceArea cols' + Math.max(1, active.length);
  for (const d of devices) {
    $('#' + d + 'Pane').classList.toggle('hidden', !enabled[d]);
    $('#toggle' + cap(d)).classList.toggle('on', enabled[d]);
    const qaEl = $('#' + d + 'Qa');
    if (!enabled[d]) { qaEl.textContent = '非表示'; qaEl.className = ''; }
    else if (!current) { qaEl.textContent = '—'; qaEl.className = ''; }
  }
  $('#open').disabled = active.length === 0;
}

function toggleDevice(device) {
  enabled[device] = !enabled[device];
  updateLayout();
  if (current) { stop(); setLog('表示端末を変更しました。再起動してください。'); }
}

function clearView() {
  stopSnapshots();
  for (const d of devices) {
    if (d === 'pc') $('#' + d).src = 'about:blank';
    else $('#' + d).removeAttribute('src');
    $('#' + d + 'Empty').style.display = 'grid';
    $('#' + d + 'State').textContent = 'OFFLINE';
    clearBusy(d);
  }
  $('#timer').textContent = '—';
  $('#currentUrls').textContent = '—';
  for (const id of ['#stop', '#go', '#qa', '#renew']) $(id).disabled = true;
  current = null;
  if (tick) clearInterval(tick);
  tick = null;
}

async function api(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body)
  });
  const raw = await r.text();
  let j = {};
  try { j = raw ? JSON.parse(raw) : {}; }
  catch { j = { error: (raw || '').slice(0, 300) || (path + ' returned a non-JSON response') }; }
  if (!r.ok) throw new Error(j.error || (path + ' failed (' + r.status + ')'));
  return j;
}

function applySession(j) {
  current = {
    sessions: j.sessions || {},
    urls: j.urls || {},
    ready: j.ready || {},
    requestedUrl: j.url || currentTargetUrl(),
    expiresInMs: j.expiresInMs || 840000
  };

  for (const d of activeDevices()) {
    const session = current.sessions[d];
    if (!session) {
      $('#' + d + 'State').textContent = j.failures?.[d] ? 'FAILED' : 'OFFLINE';
      clearBusy(d);
      continue;
    }
    if (d === 'pc') {
      $('#pc').src = viewerUrl(session.debugUrl);
      $('#pcEmpty').style.display = 'none';
      $('#pcState').textContent = 'LIVE';
      clearBusy('pc');
    } else {
      // Mobile panes stay in CONNECTING until the first snapshot is painted.
      $('#' + d + 'State').textContent = 'CONNECTING';
      busy(d, 'サイト反映待ち…');
    }
  }

  for (const id of ['#stop', '#go', '#qa', '#renew']) $(id).disabled = false;
  endAt = Date.now() + current.expiresInMs;
  startTimer();
  renderUrls(current.urls);
  startSnapshots();

  const failed = Object.entries(j.failures || {});
  if (failed.length) setLog(failed.map(([d, m]) => d + ': ' + m).join(' / '), true);
  else if (j.oidcError && j.protectedQa) setLog('QA OIDC: ' + j.oidcError, true);
  else setLog('LIVE');
}

function renderUrls(urls = {}) {
  $('#currentUrls').innerHTML = activeDevices().map(d => d + ': ' + (urls[d] || '—')).join('<br>');
}

function startTimer() {
  if (tick) clearInterval(tick);
  tick = setInterval(async () => {
    const n = Math.max(0, endAt - Date.now());
    $('#timer').textContent = Math.floor(n / 60000) + ':' + String(Math.floor((n % 60000) / 1000)).padStart(2, '0');
    if (n <= 75000 && !renewing && current) await renew(true);
    if (n <= 0 && !renewing) { clearView(); setLog('SESSION EXPIRED', true); }
  }, 1000);
}

async function openDevices() {
  if (current) await stop();
  const list = activeDevices();
  const url = currentTargetUrl();
  $('#open').disabled = true;
  setLog('端末を起動中…');
  list.forEach(d => { busy(d, '接続中…'); $('#' + d + 'State').textContent = 'STARTING'; });
  try {
    const j = await api('/api/start', { url, devices: list });
    applySession(j);
  } catch (e) {
    list.forEach(clearBusy);
    clearView();
    setLog(e.message, true);
  } finally {
    $('#open').disabled = activeDevices().length === 0;
  }
}

async function stop() {
  if (!current) return;
  const old = current;
  clearView();
  setLog('STOPPING…');
  try { await api('/api/stop', { sessions: old.sessions }); } catch {}
  setLog('STOPPED');
}

async function navigateAll() {
  if (!current) return;
  const url = currentTargetUrl();
  activeDevices().forEach(d => busy(d, 'ページ反映待ち…'));
  setLog('NAVIGATING…');
  try {
    const j = await api('/api/navigate', { sessions: current.sessions, url });
    current.urls = j.urls || {};
    current.ready = j.results || {};
    current.requestedUrl = j.requestedUrl || url;
    renderUrls(current.urls);
    for (const d of MOBILE) if (enabled[d]) pumpSnapshot(d);
    const failed = Object.entries(j.failures || {});
    setLog(failed.length ? failed.map(([d, m]) => d + ': ' + m).join(' / ') : 'LIVE', failed.length > 0);
  } catch (e) {
    setLog(e.message, true);
  } finally {
    activeDevices().forEach(d => { if (d === 'pc' || snap(d).live) clearBusy(d); });
  }
}

async function qa() {
  if (!current) return;
  activeDevices().forEach(d => busy(d, 'QA確認中…'));
  setLog('QA CHECK…');
  try {
    const j = await api('/api/inspect', {
      sessions: current.sessions,
      expectedUrls: current.urls,
      requestedUrl: current.requestedUrl,
      observed: current.ready
    });
    const details = [];
    for (const d of activeDevices()) {
      const verdict = j.qa?.[d] || 'CHECK';
      const el = $('#' + d + 'Qa');
      el.textContent = verdict;
      el.className = verdict === 'PASS' ? 'pass' : verdict === 'FAIL' ? 'fail' : 'check';
      const x = j.result?.[d];
      if (!x) continue;
      if (x.error) { details.push(d + ': ' + x.error); continue; }
      const failed = (j.reasons?.[d] || []).join(',');
      details.push(d + ' ' + x.viewport.width + '×' + x.viewport.height
        + ' touch:' + (x.touchPoints || 0)
        + ' shot:' + (x.screenshotBytes || 0) + 'B'
        + ' broken:' + x.brokenImages
        + (failed ? ' NG:' + failed : ' OK'));
    }
    $('#qaDetail').textContent = details.join(' / ');
    setLog('QA DONE');
  } catch (e) {
    setLog(e.message, true);
  } finally {
    activeDevices().forEach(d => { if (d === 'pc' || snap(d).live) clearBusy(d); });
  }
}

async function renew(auto = false) {
  if (!current || renewing) return;
  renewing = true;
  setLog(auto ? 'AUTO RENEW…' : 'RENEW…');
  try {
    const j = await api('/api/renew', { sessions: current.sessions, fallbackUrl: currentTargetUrl() });
    applySession(j);
    setLog(auto ? 'AUTO RENEWED' : 'RENEWED');
  } catch (e) {
    setLog(e.message, true);
  } finally {
    renewing = false;
  }
}

/* ------------------------------------------------------------ project/target */
function applyProjectPreset() {
  const p = $('#project').value;
  if (p === 'https://oh-my-nihon-wine.jp') { enabled.iphone = true; enabled.android = true; enabled.pc = false; }
  else if (p === 'https://dis.nihonwine.jp' || p === 'https://admin.sayaka-kitchen.com') { enabled.iphone = false; enabled.android = false; enabled.pc = true; }
  else { enabled.iphone = true; enabled.android = true; enabled.pc = true; }
  updateLayout();
}

function previewKey() {
  return 'devroom_preview_url:' + ($('#project').value || 'custom');
}

function currentTargetUrl() {
  return (activeTarget === 'preview' ? $('#previewUrl').value : $('#productionUrl').value).trim();
}

function updateTargetUi() {
  $('#useProduction').classList.toggle('active', activeTarget === 'production');
  $('#usePreview').classList.toggle('active', activeTarget === 'preview');
  $('#targetHint').textContent = '選択中: ' + (activeTarget === 'preview' ? 'Preview' : 'Production');
}

function setTargetMode(mode, navigate = true) {
  if (mode === 'preview' && !$('#previewUrl').value.trim()) {
    setLog('Preview URLが未設定です', true);
    return;
  }
  activeTarget = mode;
  updateTargetUi();
  if (current && navigate) navigateAll();
}

function loadProjectUrls() {
  const project = $('#project').value;
  $('#productionUrl').value = project || '';
  $('#previewUrl').value = localStorage.getItem(previewKey()) || PREVIEW_DEFAULTS[project] || '';
  activeTarget = 'production';
  updateTargetUi();
}

function savePreviewUrl() {
  const value = $('#previewUrl').value.trim();
  if (value) localStorage.setItem(previewKey(), value);
  else localStorage.removeItem(previewKey());
}

async function reviewWithChatty() {
  const qaState = {};
  for (const d of devices) qaState[d] = $('#' + d + 'Qa').textContent;
  const payload = {
    reviewId: 'review_' + Date.now(),
    project: $('#project').selectedOptions[0]?.textContent || 'CUSTOM',
    environment: activeTarget,
    url: currentTargetUrl(),
    devices: activeDevices(),
    qa: qaState,
    log: $('#log').textContent,
    status: $('#status').textContent,
    at: new Date().toISOString()
  };
  $('#reviewState').textContent = 'Chatty確認用に送信中…';
  try {
    const j = await api('/api/review-intent', payload);
    $('#reviewState').textContent = '確認依頼済み: ' + j.reviewId;
    setLog('CHATTY REVIEW READY');
  } catch (e) {
    $('#reviewState').textContent = '送信失敗: ' + e.message;
    setLog(e.message, true);
  }
}

async function releaseIntent(kind) {
  const qaState = {};
  for (const d of devices) qaState[d] = $('#' + d + 'Qa').textContent;
  const body = {
    kind,
    project: $('#project').selectedOptions[0]?.textContent || 'CUSTOM',
    url: currentTargetUrl(),
    qa: qaState,
    at: new Date().toISOString()
  };
  $('#releaseState').textContent = '指示送信中…';
  try {
    const j = await api('/api/release-intent', body);
    $('#releaseState').textContent = j.message || '記録しました';
  } catch (e) {
    $('#releaseState').textContent = '送信失敗: ' + e.message;
  }
}

async function loadQaBridge() {
  try {
    const r = await fetch('/api/oidc-status', { cache: 'no-store' });
    const raw = await r.text();
    let j = {};
    try { j = raw ? JSON.parse(raw) : {}; }
    catch { throw new Error('QA Bridge returned a non-JSON response'); }
    const ready = Boolean(j.oidcAvailable && j.ok);
    $('#qaBridgeState').textContent = ready ? 'READY' : 'LOCKED';
    $('#qaBridgeState').className = ready ? 'pass' : 'check';
    $('#qaBridgeDetail').textContent = ready
      ? 'Preview保護付きURLへの接続準備OK。'
      : ('Production確認は利用可能。保護付きPreviewは接続条件を確認。' + (j.error ? ' (' + j.error + ')' : ''));
  } catch (e) {
    // The QA bridge card is informational only — it never blocks device start.
    $('#qaBridgeState').textContent = 'ERROR';
    $('#qaBridgeState').className = 'fail';
    $('#qaBridgeDetail').textContent = e.message;
  }
}

/* --------------------------------------------------------------------- wiring */
$('#chattyReview').onclick = reviewWithChatty;
$('#toggleIphone').onclick = () => toggleDevice('iphone');
$('#toggleAndroid').onclick = () => toggleDevice('android');
$('#togglePc').onclick = () => toggleDevice('pc');
$('#open').onclick = openDevices;
$('#stop').onclick = stop;
$('#go').onclick = navigateAll;
$('#qa').onclick = qa;
$('#renew').onclick = () => renew(false);
$('#previewOk').onclick = () => releaseIntent('preview');
$('#productionOk').onclick = () => releaseIntent('production');
$('#project').onchange = () => { if (current) stop(); applyProjectPreset(); loadProjectUrls(); };
$('#useProduction').onclick = () => setTargetMode('production');
$('#usePreview').onclick = () => setTargetMode('preview');
$('#previewUrl').addEventListener('change', savePreviewUrl);
$('#previewUrl').addEventListener('blur', savePreviewUrl);
for (const id of ['productionUrl', 'previewUrl']) {
  $('#' + id).addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (id === 'previewUrl') savePreviewUrl();
    current ? navigateAll() : openDevices();
  });
}
window.addEventListener('beforeunload', () => {
  if (current) navigator.sendBeacon('/api/stop', new Blob([JSON.stringify({ sessions: current.sessions })], { type: 'application/json' }));
});

for (const d of MOBILE) bindDeviceInput(d);

$('#project').value = 'https://oh-my-nihon-wine.jp';
applyProjectPreset();
loadProjectUrls();
loadQaBridge();
