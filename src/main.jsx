import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Github, Sparkles, Smartphone, ShieldCheck, ArrowRight, CheckCircle2,
  Download, Loader2, LogOut, RefreshCw, Search, ExternalLink, AlertCircle
} from "lucide-react";
import "./styles.css";

const steps = ["Connect GitHub", "Select Web App", "AI Analyze", "Configure APK", "Build & Download"];

function BuildStep({ selectedRepo, appName, packageId, outputDirectory }) {
  const [starting, setStarting] = useState(false);
  const [build, setBuild] = useState(null);
  const [error, setError] = useState("");

  const startBuild = async () => {
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/build/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: selectedRepo?.fullName,
          branch: selectedRepo?.defaultBranch,
          appName,
          packageId,
          outputDirectory
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start Android build.");
      setBuild({ status: "queued", message: data.message, htmlUrl: null });
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!build || !selectedRepo) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/build/status", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: selectedRepo.fullName })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setBuild(data);
      } catch {}
    }, 5000);
    return () => clearInterval(timer);
  }, [build?.status, selectedRepo?.fullName]);

  return <>
    <div className="iconbox"><Smartphone /></div>
    <h2>Build your Android APK</h2>
    <p>Web2APK will add the Android build workflow to <b>{selectedRepo?.fullName}</b> and start GitHub Actions.</p>

    <div className="buildinfo">
      <b>{appName}</b>
      <span>{packageId}</span>
      <span>Output: {outputDirectory || "dist"}</span>
    </div>

    {error && <div className="error"><AlertCircle size={17} /> {error}</div>}

    {!build && (
      <button className="primary" onClick={startBuild} disabled={starting}>
        {starting ? <><Loader2 className="spin" size={18} /> Starting build…</> : <>Start Android Build <ArrowRight size={18} /></>}
      </button>
    )}

    {build && (
      <div className="buildstatus">
        <div className="loading-state">
          {build.status === "completed" && build.conclusion === "success"
            ? <CheckCircle2 size={28} />
            : <Loader2 className={build.status === "in_progress" || build.status === "queued" ? "spin" : ""} size={28} />}
          <div>
            <b>{build.status === "completed" ? (build.conclusion === "success" ? "APK build completed" : "APK build failed") : "Android build running…"}</b>
            <small>{build.status} {build.conclusion ? "· " + build.conclusion : ""}</small>
          </div>
        </div>

        {build.htmlUrl && <a className="secondary-link" href={build.htmlUrl} target="_blank" rel="noreferrer">View GitHub Actions <ExternalLink size={15} /></a>}

        {build.artifact?.id && !build.artifact.expired && build.conclusion === "success" && (
          <>
            <p className="success-note"><CheckCircle2 size={17} /> APK artifact is ready.</p>
            <a className="primary download-link" href={`/api/build/download?repo=${encodeURIComponent(selectedRepo.fullName)}&artifactId=${build.artifact.id}`}><Download size={18} /> Download APK</a>
          </>
        )}

        {build.status === "completed" && build.conclusion !== "success" && (
          <button className="primary" onClick={() => { setBuild(null); setError(""); }}>Try Again <RefreshCw size={17} /></button>
        )}
      </div>
    )}
  </>;
}

function AnalysisStep({ selectedRepo, onContinue, onAnalysis }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);

  const analyze = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/analyze-repo", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: selectedRepo?.fullName, branch: selectedRepo?.defaultBranch })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "AI analysis failed.");
      setAnalysis(data.analysis);
      onAnalysis?.(data.analysis);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (selectedRepo) analyze(); }, [selectedRepo]);

  return <>
    <div className="iconbox"><Sparkles /></div>
    <h2>AI project analysis</h2>
    <p>Inspecting <b>{selectedRepo?.fullName}</b> and detecting the build configuration.</p>
    {loading && <div className="loading-state"><Loader2 className="spin" size={25} /><p>Reading project files and analyzing with AI…</p></div>}
    {error && <div className="error"><AlertCircle size={17} /> {error}<button className="icon-button" onClick={analyze}><RefreshCw size={15}/></button></div>}
    {analysis && <div className="analysis">
      <div><CheckCircle2 /> Framework: <b>{analysis.framework || "Unknown"}</b></div>
      <div><CheckCircle2 /> Build command: <b>{analysis.buildCommand || "npm run build"}</b></div>
      <div><CheckCircle2 /> Output: <b>{analysis.outputDirectory || "dist"}</b></div>
      <div><CheckCircle2 /> Capacitor ready: <b>{String(analysis.capacitorReady ?? false)}</b></div>
      <div>{analysis.summary || "Analysis completed."}</div>
    </div>}
    <button className="primary" disabled={loading || !analysis} onClick={onContinue}>Continue to APK configuration <ArrowRight size={18} /></button>
  </>;
}

function App() {
  const [step, setStep] = useState(0);
  const [auth, setAuth] = useState({ loading: true, connected: false, user: null });
  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoError, setRepoError] = useState("");
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [search, setSearch] = useState("");
  const [appName, setAppName] = useState("My Web App");
  const [packageId, setPackageId] = useState("com.web2apk.app");
  const [analysis, setAnalysis] = useState(null);

  const loadAuth = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAuth({ loading: false, connected: !!data.authenticated, user: data.user || null });
        if (data.authenticated) setStep(1);
      } else setAuth({ loading: false, connected: false, user: null });
    } catch { setAuth({ loading: false, connected: false, user: null }); }
  };

  const loadRepos = async () => {
    setReposLoading(true);
    setRepoError("");
    try {
      const res = await fetch("/api/github/repos", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load GitHub repositories.");
      setRepos(data.repos || []);
    } catch (e) { setRepoError(e.message); }
    finally { setReposLoading(false); }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") window.history.replaceState({}, "", window.location.pathname);
    const githubError = params.get("github_error");
    if (githubError) {
      setRepoError("GitHub connection was not completed: " + githubError);
      window.history.replaceState({}, "", window.location.pathname);
    }
    loadAuth();
  }, []);

  useEffect(() => { if (auth.connected && step === 1) loadRepos(); }, [auth.connected, step]);

  const filteredRepos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(r => r.fullName.toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q));
  }, [repos, search]);

  const connect = () => { window.location.href = "/api/auth/github/login"; };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setAuth({ loading: false, connected: false, user: null });
    setRepos([]);
    setSelectedRepo(null);
    setAnalysis(null);
    setStep(0);
  };

  const selectRepo = repo => {
    setSelectedRepo(repo);
    setAnalysis(null);
    setAppName(repo.name || "My Web App");
    const safeName = (repo.name || "app").toLowerCase().replace(/[^a-z0-9]+/g, "");
    setPackageId("com.web2apk." + (safeName || "app"));
  };

  return <div className="app">
    <header>
      <div className="brand">
        <div className="logo"><Smartphone size={22} /></div>
        <div><b>Web2APK AI</b><span>AI Web App → Android APK</span></div>
      </div>
      {auth.connected
        ? <div className="account">{auth.user?.avatar && <img className="avatar" src={auth.user.avatar} alt="" />}<span className="account-name">{auth.user?.name || auth.user?.login}</span><button className="github secondary" onClick={logout}><LogOut size={16} /> Sign out</button></div>
        : <button className="github" onClick={connect}><Github size={18} /> Connect GitHub</button>}
    </header>

    <main>
      <section className="hero">
        <div className="pill"><Sparkles size={15} /> AI-powered APK builder</div>
        <h1>Turn your web app into an<br /><em>Android APK.</em></h1>
        <p>Connect a GitHub project, select your web app, let AI inspect it, configure the Android wrapper, and build a downloadable APK.</p>
      </section>

      <section className="steps">
        {steps.map((x, i) => <div className={i === step ? "step active" : i < step ? "step done" : "step"} key={x}><span>{i < step ? <CheckCircle2 size={16} /> : i + 1}</span>{x}</div>)}
      </section>

      <section className="card">
        {auth.loading && <div className="loading-state"><Loader2 className="spin" size={25} /><p>Checking GitHub connection…</p></div>}

        {!auth.loading && step === 0 && !auth.connected && <>
          <div className="iconbox"><Github /></div><h2>Connect your GitHub project</h2>
          <p>Sign in with GitHub. Web2APK AI will use your authorized GitHub connection to list repositories and work with the project you select.</p>
          <button className="primary" onClick={connect}>Connect GitHub <ArrowRight size={18} /></button>
        </>}

        {!auth.loading && step === 1 && auth.connected && <>
          <div className="section-head"><div><h2>Select your web app</h2><p>Choose a repository from your GitHub account.</p></div><button className="icon-button" onClick={loadRepos} disabled={reposLoading} title="Refresh repositories"><RefreshCw className={reposLoading ? "spin" : ""} size={18} /></button></div>
          <div className="searchbox"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search repositories…" /></div>
          {repoError && <div className="error"><AlertCircle size={17} /> {repoError}</div>}
          {reposLoading ? <div className="loading-state"><Loader2 className="spin" size={25} /><p>Loading your repositories…</p></div>
          : filteredRepos.length ? <div className="repo-list">{filteredRepos.map(repo => <button key={repo.id} className={"repo-item " + (selectedRepo?.id === repo.id ? "selected" : "")} onClick={() => selectRepo(repo)}><span className="repo-main"><b>{repo.fullName}</b><small>{repo.description || "No description"}</small></span><span className="repo-meta">{repo.language || "Web"} {repo.private ? "· Private" : "· Public"}</span></button>)}</div>
          : <div className="empty"><Github size={24} /><p>No repositories found.</p></div>}
          <button className="primary" disabled={!selectedRepo} onClick={() => setStep(2)}>Continue <ArrowRight size={18} /></button>
        </>}

        {step === 2 && <AnalysisStep selectedRepo={selectedRepo} onContinue={() => setStep(3)} onAnalysis={setAnalysis} />}

        {step === 3 && <>
          <h2>Configure your APK</h2><p>These Android settings are applied to the wrapper; your original web app UI is not rebuilt.</p>
          <label>App name</label><input value={appName} onChange={e => setAppName(e.target.value)} />
          <label>Package ID</label><input value={packageId} onChange={e => setPackageId(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ""))} />
          <div className="checks"><span>✓ Internet access</span><span>✓ File upload</span><span>✓ Camera ready</span></div>
          <button className="primary" onClick={() => setStep(4)}>Start Android Build <ArrowRight size={18} /></button>
        </>}

        {step === 4 && <BuildStep selectedRepo={selectedRepo} appName={appName} packageId={packageId} outputDirectory={analysis?.outputDirectory || "dist"} />}
      </section>

      <div className="trust"><ShieldCheck size={18} /><span>Security-first design: GitHub tokens and API keys stay on the server and are never placed in browser code.</span></div>
    </main>
    <footer>Web2APK AI · GitHub → AI analysis → Capacitor → Android APK</footer>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
