import { githubRequest } from "../_lib/github.js";
import { getSession } from "../_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = await getSession(req);
  if (!session?.accessToken) return res.status(401).json({ error: "Not connected to GitHub." });

  const { fullName } = req.body || {};
  if (!fullName || !fullName.includes("/")) return res.status(400).json({ error: "Repository is required." });
  const [owner, repo] = fullName.split("/", 2);

  try {
    const runs = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=10`,
      session.accessToken
    );
    const run = (runs.workflow_runs || []).find(r => r.name === "Web2APK Android Build");
    if (!run) return res.status(200).json({ status: "not_found" });

    const artifacts = run.status === "completed" && run.conclusion === "success"
      ? await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${run.id}/artifacts`, session.accessToken)
      : { artifacts: [] };

    const artifact = (artifacts.artifacts || []).find(a => a.name === "web2apk-debug-apk");

    res.status(200).json({
      status: run.status,
      conclusion: run.conclusion,
      runId: run.id,
      htmlUrl: run.html_url,
      artifact: artifact ? { id: artifact.id, name: artifact.name, expired: artifact.expired } : null
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Could not read build status." });
  }
}
