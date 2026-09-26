function validPackageId(value){return /^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(value||"");}
function validUrl(value){try{const u=new URL(value);return u.protocol==="https:"||(u.protocol==="http:"&&process.env.ALLOW_HTTP_BUILD_URLS==="true");}catch{return false;}}
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  const base=process.env.BUILD_SERVER_URL,key=process.env.BUILD_SERVER_KEY;
  if(!base||!key) return res.status(503).json({error:"Build server is not configured."});
  const {url,appName,packageId}=req.body||{};
  if(!validUrl(url)) return res.status(400).json({error:"Enter a valid HTTPS website URL."});
  if(!appName||String(appName).length>50) return res.status(400).json({error:"Invalid app name."});
  if(!validPackageId(packageId)) return res.status(400).json({error:"Invalid Android package ID."});
  try{
    const r=await fetch(base.replace(/\\/$/,"")+"/builds",{method:"POST",headers:{"Content-Type":"application/json","x-build-key":key},body:JSON.stringify({url,appName,packageId})});
    const data=await r.json().catch(()=>({})); res.status(r.status).json(data);
  }catch{res.status(502).json({error:"Build server is unreachable."});}
}
