import { getProvider } from './providers/index.mjs';
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const devices=req.body?.devices||[],sessions=req.body?.sessions||{};
    const result={},qa={};
    if(devices.includes('iphone')){result.iphone={provider:'Appetize',browser:'Mobile Safari',device:'iPhone 16 Pro',os:'iOS 18.2'};qa.iphone='VISUAL'}
    if(devices.includes('android')){result.android={provider:'Appetize',browser:'Mobile Chrome',device:'Pixel 9 Pro',os:'Android 15'};qa.android='VISUAL'}
    if(sessions.pc?.id){const p=await getProvider();const info=await p.inspectPage(sessions.pc.id);result.pc=info;qa.pc=info.hasVisibleContent&&info.brokenImages===0?'PASS':'CHECK'}
    return res.status(200).json({result,qa});
  }catch(e){return res.status(500).json({error:e?.message||String(e)})}
}
