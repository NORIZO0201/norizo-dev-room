let current=null,endAt=0,tick=null,renewing=false;
const enabled={iphone:true,android:true,pc:false};
const devices=['iphone','android','pc'];
const OMNW_QA='https://oh-my-nihon-wine-git-dev-room-qa-oh-my-nihon-wine.vercel.app';
const $=s=>document.querySelector(s);
function setLog(s,bad=false){$('#log').textContent=s;$('#status').textContent=bad?'ERROR':s}
function viewerUrl(u){if(!u)return 'about:blank';const sep=u.includes('?')?'&':'?';return u+sep+'interactive=true&showControls=true'}
function busy(device,text){const el=$('#'+device+'Busy');if(el){el.textContent=text;el.classList.add('show')}}
function clearBusy(device){const el=$('#'+device+'Busy');if(el)el.classList.remove('show')}
function activeDevices(){return devices.filter(d=>enabled[d])}
function updateLayout(){
  const active=activeDevices();
  $('#deviceArea').className='deviceArea cols'+Math.max(1,active.length);
  for(const d of devices){
    $('#'+d+'Pane').classList.toggle('hidden',!enabled[d]);
    const id='#toggle'+d.charAt(0).toUpperCase()+d.slice(1);
    $(id).classList.toggle('on',enabled[d]);
    if(!enabled[d]) $('#'+d+'Qa').textContent='非表示';
    else if(!current) $('#'+d+'Qa').textContent='—';
  }
  $('#open').disabled=active.length===0;
}
function toggleDevice(device){
  enabled[device]=!enabled[device];
  updateLayout();
  if(current){stop();setLog('表示端末を変更しました。再起動してください。')}
}
function clearView(){
  for(const d of devices){
    $('#'+d).src='about:blank';
    $('#'+d+'Empty').style.display='grid';
    $('#'+d+'State').textContent='OFFLINE';
    clearBusy(d);
  }
  $('#timer').textContent='—';$('#currentUrls').textContent='—';
  for(const id of ['#stop','#go','#qa','#renew'])$(id).disabled=true;
  current=null;if(tick)clearInterval(tick);
}
async function api(path,body){
  const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||path+' failed');
  return j;
}
function applySession(j){
  current={sessions:j.sessions,urls:j.urls,expiresInMs:j.expiresInMs};
  for(const d of activeDevices()){
    const s=j.sessions[d];if(!s)continue;
    $('#'+d).src=viewerUrl(s.debugUrl);
    $('#'+d+'Empty').style.display='none';
    $('#'+d+'State').textContent='LIVE';
    clearBusy(d);
  }
  for(const id of ['#stop','#go','#qa','#renew'])$(id).disabled=false;
  endAt=Date.now()+j.expiresInMs;startTimer();renderUrls(j.urls);setLog('LIVE');
}
function renderUrls(urls={}){
  $('#currentUrls').innerHTML=activeDevices().map(d=>d+': '+(urls[d]||'—')).join('<br>');
}
function startTimer(){
  if(tick)clearInterval(tick);
  tick=setInterval(async()=>{
    const n=Math.max(0,endAt-Date.now());
    $('#timer').textContent=Math.floor(n/60000)+':'+String(Math.floor((n%60000)/1000)).padStart(2,'0');
    if(n<=75000&&!renewing&&current)await renew(true);
    if(n<=0&&!renewing){clearView();setLog('SESSION EXPIRED',true)}
  },1000);
}
async function openDevices(){
  if(current)await stop();
  const list=activeDevices();const url=$('#url').value.trim();
  $('#open').disabled=true;setLog('端末を起動中…');
  list.forEach(d=>{busy(d,'接続中…');$('#'+d+'State').textContent='STARTING'});
  try{
    const j=await api('/api/start',{url,devices:list});
    applySession(j);list.forEach(d=>busy(d,'サイト反映待ち…'));
    await new Promise(r=>setTimeout(r,700));list.forEach(clearBusy);
  }catch(e){list.forEach(clearBusy);clearView();setLog(e.message,true)}
  finally{$('#open').disabled=activeDevices().length===0}
}
async function stop(){
  if(!current)return;
  const old=current;clearView();setLog('STOPPING…');
  try{await api('/api/stop',{sessions:old.sessions})}catch{}
  setLog('STOPPED');
}
async function navigateAll(){
  if(!current)return;
  const url=$('#url').value.trim();activeDevices().forEach(d=>busy(d,'ページ反映待ち…'));setLog('NAVIGATING…');
  try{const j=await api('/api/navigate',{sessions:current.sessions,url});current.urls=j.urls;renderUrls(j.urls);setLog('LIVE')}
  catch(e){setLog(e.message,true)}
  finally{activeDevices().forEach(clearBusy)}
}
async function qa(){
  if(!current)return;activeDevices().forEach(d=>busy(d,'QA確認中…'));setLog('QA CHECK…');
  try{
    const j=await api('/api/inspect',{sessions:current.sessions});const details=[];
    for(const d of activeDevices()){
      const q=j.qa[d]||'CHECK';const el=$('#'+d+'Qa');el.textContent=q;el.className=q==='PASS'?'pass':'check';
      const x=j.result[d];if(x)details.push(d+' '+x.viewport.width+'×'+x.viewport.height+' touch:'+(x.touchPoints||0)+' broken:'+x.brokenImages);
    }
    $('#qaDetail').textContent=details.join(' / ');setLog('QA DONE');
  }catch(e){setLog(e.message,true)}
  finally{activeDevices().forEach(clearBusy)}
}
async function renew(auto=false){
  if(!current||renewing)return;renewing=true;setLog(auto?'AUTO RENEW…':'RENEW…');
  try{const j=await api('/api/renew',{sessions:current.sessions,fallbackUrl:$('#url').value.trim()});applySession(j);setLog(auto?'AUTO RENEWED':'RENEWED')}
  catch(e){setLog(e.message,true)}finally{renewing=false}
}
function resolvedTarget(){
  const project=$('#project').value,mode=$('#environment').value;
  if(project==='https://oh-my-nihon-wine.jp'){
    if(mode==='qa-guest')return OMNW_QA+'/welcome';
    if(mode==='qa-auth')return OMNW_QA+'/collection?qa=1';
  }
  return project||$('#url').value.trim();
}
function applyProjectPreset(){
  const p=$('#project').value;
  if(p==='https://oh-my-nihon-wine.jp'){enabled.iphone=true;enabled.android=true;enabled.pc=false}
  else if(p==='https://dis.nihonwine.jp'||p==='https://admin.sayaka-kitchen.com'){enabled.iphone=false;enabled.android=false;enabled.pc=true}
  else{enabled.iphone=true;enabled.android=true;enabled.pc=true}
  updateLayout();
}
function refreshTarget(){
  const next=resolvedTarget();if(next)$('#url').value=next;
  const isOmnw=$('#project').value==='https://oh-my-nihon-wine.jp';
  $('#environment').disabled=!isOmnw;if(!isOmnw)$('#environment').value='production';
}
async function releaseIntent(kind){
  const qaState={};for(const d of devices)qaState[d]=$('#'+d+'Qa').textContent;
  const body={kind,project:$('#project').selectedOptions[0]?.textContent||'CUSTOM',url:$('#url').value.trim(),qa:qaState,at:new Date().toISOString()};
  $('#releaseState').textContent='指示送信中…';
  try{const j=await api('/api/release-intent',body);$('#releaseState').textContent=j.message||'記録しました'}
  catch(e){$('#releaseState').textContent='送信失敗: '+e.message}
}
async function loadQaBridge(){
  try{
    const r=await fetch('/api/oidc-status',{cache:'no-store'});const j=await r.json();const ready=Boolean(j.oidcAvailable&&j.ok);
    $('#qaBridgeState').textContent=ready?'READY':'LOCKED';$('#qaBridgeState').className=ready?'pass':'check';
    $('#qaBridgeDetail').textContent=ready?'OMNW固定QA環境へ接続可能。':'OMNW固定QA環境の保護解除待ち。Production確認は利用可能。';
    for(const o of $('#environment').options)if(o.value!=='production')o.disabled=!ready;
  }catch(e){$('#qaBridgeState').textContent='ERROR';$('#qaBridgeState').className='fail';$('#qaBridgeDetail').textContent=e.message}
}
$('#toggleIphone').onclick=()=>toggleDevice('iphone');
$('#toggleAndroid').onclick=()=>toggleDevice('android');
$('#togglePc').onclick=()=>toggleDevice('pc');
$('#open').onclick=openDevices;$('#stop').onclick=stop;$('#go').onclick=navigateAll;$('#qa').onclick=qa;$('#renew').onclick=()=>renew(false);
$('#previewOk').onclick=()=>releaseIntent('preview');$('#productionOk').onclick=()=>releaseIntent('production');
$('#project').onchange=()=>{if(current)stop();applyProjectPreset();refreshTarget()};
$('#environment').onchange=()=>{refreshTarget();if(current)navigateAll()};
$('#url').addEventListener('keydown',e=>{if(e.key==='Enter'){current?navigateAll():openDevices()}});
window.addEventListener('beforeunload',()=>{if(current)navigator.sendBeacon('/api/stop',new Blob([JSON.stringify({sessions:current.sessions})],{type:'application/json'}))});
$('#project').value='https://oh-my-nihon-wine.jp';applyProjectPreset();refreshTarget();loadQaBridge();