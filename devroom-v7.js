let current=null,endAt=0,tick=null,renewing=false;
const enabled={iphone:true,android:true,pc:false};
const devices=['iphone','android','pc'];
const OMNW_QA='https://oh-my-nihon-wine-git-dev-room-qa-oh-my-nihon-wine.vercel.app';
const PREVIEW_REGISTRY_URLS=[
  'https://raw.githubusercontent.com/NORIZO0201/norizo-dev-room/main/state/PREVIEW_REGISTRY.json',
  'https://raw.githubusercontent.com/NORIZO0201/norizo-dev-room/ops/preview-first-2026-09-22/state/PREVIEW_REGISTRY.json'
];
let previewRegistry={services:{}};
const PROJECT_KEYS={
  'https://oh-my-nihon-wine.jp':'OMNW',
  'https://nihonwine.jp':'NIHON_WINE_JP',
  'https://craft-nihon-wine.jp':'CNW',
  'https://craftwineshop.com':'CWS',
  'https://dis.nihonwine.jp':'DIS',
  'https://nihoncheese.jp':'NIHON_CHEESE',
  'https://sayaka-kitchen.com':'SAYAKA',
  'https://app.sayaka-kitchen.com':'SAYAKA',
  'https://admin.sayaka-kitchen.com':'SAYAKA',
  'https://local-engine.jp':'LOCAL_ENGINE'
};
const $=s=>document.querySelector(s);
function setLog(s,bad=false){$('#log').textContent=s;$('#status').textContent=bad?'ERROR':s}
function viewerUrl(u){if(!u)return 'about:blank';const sep=u.includes('?')?'&':'?';return u+sep+'interactive=true&showControls=true'}
function busy(d,t){const e=$('#'+d+'Busy');if(e){e.textContent=t;e.classList.add('show')}}
function clearBusy(d){$('#'+d+'Busy')?.classList.remove('show')}
function activeDevices(){return devices.filter(d=>enabled[d])}
function updateLayout(){const a=activeDevices();$('#deviceArea').className='deviceArea cols'+Math.max(1,a.length);for(const d of devices){$('#'+d+'Pane').classList.toggle('hidden',!enabled[d]);$('#toggle'+d.charAt(0).toUpperCase()+d.slice(1)).classList.toggle('on',enabled[d]);$('#'+d+'Qa').textContent=enabled[d]?(current?'—':'—'):'非表示'}$('#open').disabled=a.length===0}
function toggleDevice(d){enabled[d]=!enabled[d];updateLayout();if(current){stop();setLog('表示端末を変更しました。再起動してください。')}}
function clearView(){for(const d of devices){$('#'+d).src='about:blank';$('#'+d+'Empty').style.display='grid';$('#'+d+'State').textContent='OFFLINE';clearBusy(d)}$('#timer').textContent='—';$('#currentUrls').textContent='—';for(const id of ['#stop','#go','#qa','#renew'])$(id).disabled=true;current=null;if(tick)clearInterval(tick)}
async function api(path,body){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||path+' failed');return j}
function applySession(j){current={sessions:j.sessions||{},urls:j.urls||{},embedUrls:j.embedUrls||{},devices:j.devices||activeDevices(),expiresInMs:j.expiresInMs||840000};for(const d of activeDevices()){if(d==='pc'&&j.sessions?.pc?.debugUrl)$('#pc').src=viewerUrl(j.sessions.pc.debugUrl);if(d!=='pc'&&j.embedUrls?.[d])$('#'+d).src=j.embedUrls[d];$('#'+d+'Empty').style.display='none';$('#'+d+'State').textContent=d==='pc'?'LIVE · STEEL':'LIVE · APPETIZE';clearBusy(d)}for(const id of ['#stop','#go','#qa','#renew'])$(id).disabled=false;endAt=Date.now()+current.expiresInMs;startTimer();renderUrls(current.urls);setLog('LIVE')}
function renderUrls(urls={}){$('#currentUrls').innerHTML=activeDevices().map(d=>d+': '+(urls[d]||'—')).join('<br>')}
function startTimer(){if(tick)clearInterval(tick);tick=setInterval(async()=>{const n=Math.max(0,endAt-Date.now());$('#timer').textContent=Math.floor(n/60000)+':'+String(Math.floor((n%60000)/1000)).padStart(2,'0');if(n<=75000&&!renewing&&current&&current.sessions?.pc)await renew(true);if(n<=0&&!renewing&&!current?.sessions?.pc){$('#timer').textContent='Appetize管理'}},1000)}
function getAppetizeId(){return localStorage.getItem('devroom_appetize_sandbox_id')||''}
function setAppetizeUi(){
  const id=getAppetizeId();
  $('#appetizeId').value=id;
  $('#appetizeState').textContent=id?'設定済み: '+id.slice(0,18)+'…':'未設定 — Appetize Device Sandboxで standalone_... を1回だけ登録';
  $('#appetizeState').className=id?'msg pass':'msg check';
}
async function openDevices(){if(current)await stop();const list=activeDevices(),url=$('#url').value.trim();$('#open').disabled=true;setLog('端末を起動中…');list.forEach(d=>{busy(d,'接続中…');$('#'+d+'State').textContent='STARTING'});try{const j=await api('/api/start',{url,devices:list,appetizeBuildId:getAppetizeId()});applySession(j);await new Promise(r=>setTimeout(r,700));list.forEach(clearBusy)}catch(e){list.forEach(clearBusy);clearView();setLog(e.message,true)}finally{$('#open').disabled=activeDevices().length===0}}
async function stop(){if(!current)return;const old=current;clearView();try{await api('/api/stop',{sessions:old.sessions})}catch{}setLog('STOPPED')}
async function navigateAll(){if(!current)return;const url=$('#url').value.trim();activeDevices().forEach(d=>busy(d,'ページ反映待ち…'));try{const j=await api('/api/navigate',{sessions:current.sessions,devices:activeDevices(),url});current.urls=j.urls||{};current.embedUrls=j.embedUrls||{};if(enabled.iphone&&j.embedUrls?.iphone)$('#iphone').src=j.embedUrls.iphone;if(enabled.android&&j.embedUrls?.android)$('#android').src=j.embedUrls.android;renderUrls(current.urls);setLog('LIVE')}catch(e){setLog(e.message,true)}finally{activeDevices().forEach(clearBusy)}}
async function qa(){if(!current)return;try{const j=await api('/api/inspect',{sessions:current.sessions,devices:activeDevices()});const details=[];for(const d of activeDevices()){const q=j.qa[d]||'CHECK',el=$('#'+d+'Qa');el.textContent=q;el.className=q==='PASS'?'pass':q==='VISUAL'?'check':'check';const x=j.result[d];if(x)details.push(d+': '+(x.browser||x.title||'visual check'))}$('#qaDetail').textContent=details.join(' / ');setLog('QA DONE')}catch(e){setLog(e.message,true)}}
async function renew(auto=false){if(!current||renewing||!current.sessions?.pc)return;renewing=true;try{const j=await api('/api/renew',{sessions:current.sessions,fallbackUrl:$('#url').value.trim()});current.sessions={...current.sessions,...j.sessions};if(j.sessions?.pc?.debugUrl)$('#pc').src=viewerUrl(j.sessions.pc.debugUrl);endAt=Date.now()+(j.expiresInMs||840000);setLog(auto?'AUTO RENEWED':'RENEWED')}catch(e){setLog(e.message,true)}finally{renewing=false}}
function projectKey(p){return PROJECT_KEYS[p]||''}
function previewUrlFor(p){
  const svc=previewRegistry?.services?.[projectKey(p)];
  return svc?.preview_url||'';
}
function resolvedTarget(){
  const p=$('#project').value,m=$('#environment').value;
  const preview=previewUrlFor(p);
  if(p==='https://oh-my-nihon-wine.jp'){
    const base=preview||OMNW_QA;
    if(m==='qa-guest')return base+'/welcome';
    if(m==='qa-auth')return base+'/collection?qa=1';
  }
  if(m==='preview'&&preview)return preview;
  return p||$('#url').value.trim();
}
function applyProjectPreset(){const p=$('#project').value;if(p==='https://oh-my-nihon-wine.jp'){enabled.iphone=true;enabled.android=true;enabled.pc=false}else if(p==='https://dis.nihonwine.jp'||p==='https://admin.sayaka-kitchen.com'){enabled.iphone=false;enabled.android=false;enabled.pc=true}else{enabled.iphone=true;enabled.android=true;enabled.pc=true}updateLayout()}
function refreshTarget(){
  const p=$('#project').value;
  const isOmnw=p==='https://oh-my-nihon-wine.jp';
  const m=$('#environment').value;
  if(!isOmnw&&(m==='qa-guest'||m==='qa-auth'))$('#environment').value='preview';
  const next=resolvedTarget();
  if(next)$('#url').value=next;
  const preview=previewUrlFor(p);
  if($('#previewUrlState'))$('#previewUrlState').textContent=preview||'READY Previewなし';
}
async function reviewWithChatty(){
  const qaState={};for(const d of devices)qaState[d]=$('#'+d+'Qa').textContent;
  const payload={
    reviewId:'review_'+Date.now(),
    project:$('#project').selectedOptions[0]?.textContent||'CUSTOM',
    environment:$('#environment').value,
    url:$('#url').value.trim(),
    devices:activeDevices(),
    qa:qaState,
    log:$('#log').textContent,
    status:$('#status').textContent,
    appetizeConfigured:Boolean(getAppetizeId()),
    at:new Date().toISOString()
  };
  $('#reviewState').textContent='Chatty確認用に送信中…';
  try{
    const j=await api('/api/review-intent',payload);
    $('#reviewState').textContent='確認依頼済み: '+j.reviewId;
    setLog('CHATTY REVIEW READY');
  }catch(e){
    $('#reviewState').textContent='送信失敗: '+e.message;
    setLog(e.message,true);
  }
}
async function releaseIntent(kind){const qaState={};for(const d of devices)qaState[d]=$('#'+d+'Qa').textContent;const body={kind,project:$('#project').selectedOptions[0]?.textContent||'CUSTOM',url:$('#url').value.trim(),qa:qaState,at:new Date().toISOString()};$('#releaseState').textContent='指示送信中…';try{const j=await api('/api/release-intent',body);$('#releaseState').textContent=j.message||'記録しました'}catch(e){$('#releaseState').textContent='送信失敗: '+e.message}}
async function loadQaBridge(){try{const r=await fetch('/api/oidc-status',{cache:'no-store'});const j=await r.json();const ready=Boolean(j.oidcAvailable&&j.ok);$('#qaBridgeState').textContent=ready?'READY':'APPETIZE DIRECT';$('#qaBridgeState').className=ready?'pass':'check';$('#qaBridgeDetail').textContent=ready?'PC/Steelは保護付きQAへ接続可能。Appetizeは公開URLを直接表示。':'AppetizeはProduction URLを直接表示。QA Previewは公開例外設定時に利用可能。'}catch(e){$('#qaBridgeState').textContent='CHECK';$('#qaBridgeDetail').textContent=e.message}}
$('#saveAppetizeId').onclick=()=>{
  const id=$('#appetizeId').value.trim();
  if(id && !/^standalone_[A-Za-z0-9_-]+$/.test(id)){setLog('Sandbox IDは standalone_... の形式です',true);return}
  if(id)localStorage.setItem('devroom_appetize_sandbox_id',id);else localStorage.removeItem('devroom_appetize_sandbox_id');
  setAppetizeUi();setLog(id?'APPETIZE SANDBOX SAVED':'APPETIZE SANDBOX CLEARED');
};
$('#chattyReview').onclick=reviewWithChatty;
$('#toggleIphone').onclick=()=>toggleDevice('iphone');$('#toggleAndroid').onclick=()=>toggleDevice('android');$('#togglePc').onclick=()=>toggleDevice('pc');$('#open').onclick=openDevices;$('#stop').onclick=stop;$('#go').onclick=navigateAll;$('#qa').onclick=qa;$('#renew').onclick=()=>renew(false);$('#productionOk').onclick=()=>releaseIntent('production');$('#project').onchange=()=>{if(current)stop();applyProjectPreset();refreshTarget()};$('#environment').onchange=()=>{refreshTarget();if(current)navigateAll()};$('#url').addEventListener('keydown',e=>{if(e.key==='Enter'){current?navigateAll():openDevices()}});window.addEventListener('beforeunload',()=>{if(current?.sessions?.pc)navigator.sendBeacon('/api/stop',new Blob([JSON.stringify({sessions:current.sessions})],{type:'application/json'}))});async function loadPreviewRegistry(){
  for(const base of PREVIEW_REGISTRY_URLS){
    try{
      const r=await fetch(base+'?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)continue;
      previewRegistry=await r.json();
      refreshTarget();
      return;
    }catch{}
  }
  if($('#previewUrlState'))$('#previewUrlState').textContent='Preview registry unavailable';
}
$('#project').value='https://oh-my-nihon-wine.jp';
$('#environment').value='preview';
applyProjectPreset();refreshTarget();setAppetizeUi();loadQaBridge();loadPreviewRegistry();