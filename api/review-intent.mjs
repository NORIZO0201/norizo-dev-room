export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const body=req.body||{};
  const event={
    type:'DEV_ROOM_CHATTY_REVIEW',
    reviewId:String(body.reviewId||('review_'+Date.now())),
    project:String(body.project||''),
    environment:String(body.environment||''),
    url:String(body.url||''),
    devices:Array.isArray(body.devices)?body.devices:[],
    qa:body.qa||{},
    log:String(body.log||''),
    status:String(body.status||''),
    appetizeConfigured:Boolean(body.appetizeConfigured),
    at:String(body.at||new Date().toISOString())
  };
  console.log(JSON.stringify(event));
  return res.status(200).json({ok:true,reviewId:event.reviewId,message:'Chatty review event recorded'});
}