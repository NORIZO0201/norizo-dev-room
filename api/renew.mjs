import { getProvider } from './providers/index.mjs';
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const old=req.body?.sessions||{},fallbackUrl=req.body?.fallbackUrl||'https://example.com';
  try{
    const sessions={},urls={};
    if(old.pc?.id){
      const p=await getProvider();
      const pcUrl=await p.getUrl(old.pc.id).catch(()=>fallbackUrl);
      await p.release(old.pc.id).catch(()=>{});
      sessions.pc=await p.createSession({dimensions:{width:1440,height:900},...(old.pc.profileId?{profileId:old.pc.profileId}:{}),persistProfile:true});
      urls.pc=await p.goto(sessions.pc.id,pcUrl);
      return res.status(200).json({sessions,urls,expiresInMs:p.SESSION_MS});
    }
    return res.status(200).json({sessions,urls,expiresInMs:840000});
  }catch(e){return res.status(500).json({error:e?.message||String(e)})}
}
