import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Github, Sparkles, Smartphone, ShieldCheck, ArrowRight, CheckCircle2, Download, Settings2, Loader2} from 'lucide-react';
import './styles.css';

const steps=['Connect GitHub','Select Web App','AI Analyze','Configure APK','Build & Download'];

function App(){
 const [step,setStep]=useState(0);
 const [repo,setRepo]=useState('');
 const [appName,setAppName]=useState('My Web App');
 const [packageId,setPackageId]=useState('com.web2apk.app');
 const [building,setBuilding]=useState(false);
 const [built,setBuilt]=useState(false);
 const next=()=>setStep(s=>Math.min(4,s+1));
 const build=()=>{setBuilding(true);setTimeout(()=>{setBuilding(false);setBuilt(true);setStep(4)},1800)};
 return <div className="app">
  <header><div className="brand"><div className="logo"><Smartphone size={22}/></div><div><b>Web2APK AI</b><span>AI Web App → Android APK</span></div></div><button className="github"><Github size={18}/> Connect GitHub</button></header>
  <main>
   <section className="hero"><div className="pill"><Sparkles size={15}/> AI-powered APK builder</div><h1>Turn your web app into an<br/><em>Android APK.</em></h1><p>Connect a GitHub project, let AI inspect the web app, configure the Android wrapper, and build a downloadable APK.</p></section>
   <section className="steps">{steps.map((x,i)=><div className={i===step?'step active':i<step?'step done':'step'} key={x}><span>{i<step?<CheckCircle2 size={16}/>:i+1}</span>{x}</div>)}</section>
   <section className="card">
    {step===0&&<><div className="iconbox"><Github/></div><h2>Connect your GitHub project</h2><p>Web2APK AI will use GitHub only to read your selected project and run the Android build workflow. Tokens stay on the server.</p><button className="primary" onClick={next}>Connect GitHub <ArrowRight size={18}/></button></>}
    {step===1&&<><h2>Select your web app</h2><p>Enter the GitHub repository you want to package.</p><label>Repository</label><input value={repo} onChange={e=>setRepo(e.target.value)} placeholder="owner/repository"/><button className="primary" disabled={!repo.trim()} onClick={next}>Continue <ArrowRight size={18}/></button></>}
    {step===2&&<><div className="iconbox"><Sparkles/></div><h2>AI project analysis</h2><p>AI will detect the framework, build command, output directory, package configuration, and Android compatibility before building.</p><div className="analysis"><CheckCircle2/> Framework detection<br/><CheckCircle2/> Build configuration<br/><CheckCircle2/> Capacitor Android wrapper<br/><CheckCircle2/> Required permissions</div><button className="primary" onClick={next}>Analyze & Continue <ArrowRight size={18}/></button></>}
    {step===3&&<><h2>Configure your APK</h2><p>These settings can be changed without rebuilding your web app UI.</p><label>App name</label><input value={appName} onChange={e=>setAppName(e.target.value)}/><label>Package ID</label><input value={packageId} onChange={e=>setPackageId(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g,''))}/><div className="checks"><span>✓ Internet access</span><span>✓ File upload</span><span>✓ Camera ready</span></div><button className="primary" onClick={build}>{building?<><Loader2 className="spin"/> Building…</>:<>Build APK <ArrowRight size={18}/></>}</button></>}
    {step===4&&<><div className="success"><CheckCircle2/></div><h2>APK build ready</h2><p>{built?'The MVP build pipeline is ready to be connected to GitHub Actions.':'Your APK build configuration is saved.'}</p><div className="buildinfo"><b>{appName}</b><span>{packageId}</span></div><button className="primary" disabled={!built}><Download size={18}/> Download APK</button></>}
   </section>
   <div className="trust"><ShieldCheck size={18}/><span>Security-first design: API keys and GitHub credentials are never placed in browser code.</span></div>
  </main>
  <footer>Web2APK AI · Built for simple, one-tap web-to-APK packaging</footer>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);