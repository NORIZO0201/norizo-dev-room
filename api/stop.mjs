import { getProvider } from './providers/index.mjs';
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const pc=req.body?.sessions?.pc;
    if(pc?.id){const p=await getProvider();await p.release(pc.id).catch(()=>{})}
    return res.status(200).json({ok:true});
  }catch(e){return res.status(500).json({error:e?.message||String(e)})}
}
