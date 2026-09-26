import express from "express";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const app = express();
app.use(express.json({ limit: "32kb" }));
const PORT = Number(process.env.PORT || 8080);
const API_KEY = process.env.BUILD_SERVER_KEY || "";
const ROOT = process.env.BUILD_ROOT || "/tmp/web2apk-builds";
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_BUILDS || 1);
const jobs = new Map(), queue = [];
let running = 0;

function auth(req,res,next){ if(!API_KEY || req.get("x-build-key")!==API_KEY) return res.status(401).json({error:"Unauthorized"}); next(); }
function validPackageId(v){ return /^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(String(v||"")); }
function validUrl(v){ try{const u=new URL(v); return (u.protocol==="https:"||(u.protocol==="http:"&&process.env.ALLOW_HTTP==="true"))&&!u.username&&!u.password;}catch{return false;} }
function safeName(v){ return String(v).replace(/[^a-zA-Z0-9._-]/g,"-").slice(0,50)||"web2apk"; }
function run(cmd,args,cwd,log){ return new Promise((resolve,reject)=>{const c=spawn(cmd,args,{cwd,env:process.env}); c.stdout.on("data",d=>log(String(d))); c.stderr.on("data",d=>log(String(d))); c.on("error",reject); c.on("close",n=>n===0?resolve():reject(new Error(cmd+" exited with code "+n)));}); }

async function processJob(job){
  running++; job.status="building";
  const dir=path.join(ROOT,job.id);
  try{
    await fs.mkdir(path.join(dir,"www"),{recursive:true});
    await fs.writeFile(path.join(dir,"www","index.html"),"<!doctype html><html><body></body></html>");
    const config='import type { CapacitorConfig } from "@capacitor/cli";\nconst config: CapacitorConfig = {\n  appId: '+JSON.stringify(job.packageId)+',\n  appName: '+JSON.stringify(job.appName)+',\n  webDir: "www",\n  server: { url: '+JSON.stringify(job.url)+', cleartext: '+(job.url.startsWith("http:")?"true":"false")+', androidScheme: "https" }\n};\nexport default config;\n';
    const pkg={private:true,type:"module",scripts:{"build:android":"npx cap sync android && cd android && ./gradlew assembleDebug bundleDebug"},dependencies:{"@capacitor/core":"^7.4.3"},devDependencies:{"@capacitor/cli":"^7.4.3","@capacitor/android":"^7.4.3","typescript":"^5.9.2"}};
    await fs.writeFile(path.join(dir,"package.json"),JSON.stringify(pkg,null,2));
    await fs.writeFile(path.join(dir,"capacitor.config.ts"),config);
    job.message="Installing Capacitor";
    await run("npm",["install","--no-audit","--no-fund"],dir,s=>job.log=(job.log+s).slice(-12000));
    job.message="Creating Android project";
    await run("npx",["cap","add","android"],dir,s=>job.log=(job.log+s).slice(-12000));
    await run("npx",["cap","sync","android"],dir,s=>job.log=(job.log+s).slice(-12000));
    job.message="Building APK and AAB";
    await run("./gradlew",["assembleDebug","bundleDebug"],path.join(dir,"android"),s=>job.log=(job.log+s).slice(-12000));
    job.apkPath=path.join(dir,"android/app/build/outputs/apk/debug/app-debug.apk");
    job.aabPath=path.join(dir,"android/app/build/outputs/bundle/debug/app-debug.aab");
    await fs.access(job.apkPath); await fs.access(job.aabPath);
    job.status="completed"; job.message="Build completed";
  }catch(e){ job.status="failed"; job.message=e.message||"Build failed"; }
  finally{ running--; pump(); }
}
function pump(){ while(running<MAX_CONCURRENT&&queue.length) processJob(queue.shift()); }

app.get("/health",(_req,res)=>res.json({ok:true,service:"web2apk-build-server",running,queued:queue.length}));
app.post("/builds",auth,(req,res)=>{
  const {url,appName,packageId}=req.body||{};
  if(!validUrl(url)) return res.status(400).json({error:"A valid HTTPS website URL is required."});
  if(typeof appName!=="string"||!appName.trim()||appName.length>50) return res.status(400).json({error:"Invalid app name."});
  if(!validPackageId(packageId)) return res.status(400).json({error:"Invalid Android package ID."});
  const id=crypto.randomUUID(), job={id,url,appName:appName.trim(),packageId,status:"queued",message:"Queued for Android build",createdAt:Date.now(),log:""};
  jobs.set(id,job); queue.push(job); pump();
  res.status(202).json({jobId:id,status:job.status,message:job.message});
});
app.get("/builds/:id",auth,(req,res)=>{
  const j=jobs.get(req.params.id); if(!j) return res.status(404).json({error:"Build not found."});
  res.json({jobId:j.id,status:j.status,message:j.message,log:(j.log||"").slice(-6000),apkReady:!!j.apkPath,aabReady:!!j.aabPath});
});
async function sendFile(req,res,type){
  const j=jobs.get(req.params.id); if(!j||j.status!=="completed") return res.status(404).json({error:"Build artifact is not ready."});
  const file=type==="apk"?j.apkPath:j.aabPath;
  res.download(file,safeName(j.appName)+"."+type);
}
app.get("/builds/:id/apk",auth,(req,res)=>sendFile(req,res,"apk"));
app.get("/builds/:id/aab",auth,(req,res)=>sendFile(req,res,"aab"));
app.listen(PORT,async()=>{await fs.mkdir(ROOT,{recursive:true});console.log("Web2APK build server listening on :"+PORT);});
