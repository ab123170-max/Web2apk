export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  const base=process.env.BUILD_SERVER_URL,key=process.env.BUILD_SERVER_KEY;
  if(!base||!key) return res.status(503).json({error:"Build server is not configured."});
  const {jobId}=req.body||{};
  if(!/^[0-9a-f-]{36}$/.test(String(jobId||""))) return res.status(400).json({error:"Invalid build ID."});
  try{const r=await fetch(base.replace(/\\/$/,"")+"/builds/"+jobId,{headers:{"x-build-key":key}});const data=await r.json().catch(()=>({}));res.status(r.status).json(data);}catch{res.status(502).json({error:"Build server is unreachable."});}
}
