import vercelFunctions from '@vercel/functions';
const { getVercelOidcToken } = vercelFunctions;
import { getProvider } from './providers/index.mjs';
import { NATIVE_DEVICE_KINDS, navigate as navigateNativeHost } from './providers/native-host.mjs';

function appetizeUrl(device, url) {
  const p = new URLSearchParams({
    autoplay: 'true',
    scale: 'auto',
    orientation: 'portrait',
    screenOnly: 'false',
    deviceColor: 'black',
    codec: 'jpeg',
    launchUrl: url
  });
  if (device === 'iphone') {
    p.set('device','iphone16pro');
    p.set('osVersion','18.2');
  } else {
    p.set('device','pixel9pro');
    p.set('osVersion','15.0');
  }
  return 'https://appetize.io/standalone?' + p.toString();
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const url=req.body?.url;
  if(typeof url!=='string'||!/^https?:\/\//i.test(url))return res.status(400).json({error:'Invalid URL'});
  try{
    const sessions=req.body?.sessions||{},devices=req.body?.devices||[];
    const urls={},embedUrls={},nativeState={};
    if(devices.includes('iphone')){urls.iphone=url;embedUrls.iphone=appetizeUrl('iphone',url)}
    if(devices.includes('android')){urls.android=url;embedUrls.android=appetizeUrl('android',url)}
    if(sessions.pc?.id){
      const p=await getProvider();
      const protectedQa=/\.vercel\.app/i.test(url)&&/git-dev-room-qa/i.test(url);
      const oidc=protectedQa?getVercelOidcToken():undefined;
      const extraHTTPHeaders=oidc?{'x-vercel-trusted-oidc-idp-token':oidc}:undefined;
      urls.pc=await p.goto(sessions.pc.id,url,{extraHTTPHeaders});
    }
    // Best-effort: forward the URL change to a real iOS Simulator / Android
    // Emulator host when one is configured, so "Go" reaches the native path
    // too. A missing/unreachable host never blocks the Appetize/PC response.
    await Promise.all(NATIVE_DEVICE_KINDS.filter(k=>devices.includes(k)).map(async k=>{
      try{nativeState[k]={ok:true,result:await navigateNativeHost(k,url)}}
      catch(e){nativeState[k]={ok:false,error:e?.message||String(e)}}
    }));
    return res.status(200).json({ok:true,urls,embedUrls,nativeState});
  }catch(e){return res.status(500).json({error:e?.message||String(e)})}
}
