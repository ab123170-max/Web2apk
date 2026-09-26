export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({error:"Method not allowed"});
  const base=process.env.BUILD_SERVER_URL,key=process.env.BUILD_SERVER_KEY;
  if(!base||!key) return res.status(503).json({error:"Build server is not configured."});
  const jobId=String(req.query?.jobId||""),type=String(req.query?.type||"apk");
  if(!/^[0-9a-f-]{36}$/.test(jobId)||!["apk","aab"].includes(type)) return res.status(400).json({error:"Invalid download request."});
  try{const r=await fetch(base.replace(/\\/$/,"")+"/builds/"+jobId+"/"+type,{headers:{"x-build-key":key}});if(!r.ok)return res.status(r.status).json({error:"Artifact is not ready."});res.setHeader("Content-Type",type==="apk"?"application/vnd.android.package-archive":"application/octet-stream");res.setHeader("Content-Disposition",'attachment; filename="web2apk-'+type+'.'+type+'"');res.status(200).end(Buffer.from(await r.arrayBuffer()));}catch{res.status(502).json({error:"Build server is unreachable."});}
}
