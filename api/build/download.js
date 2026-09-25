import { githubRequest } from "../_lib/github.js";
import { getSession } from "../_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const session = await getSession(req);
  if (!session?.accessToken) return res.status(401).json({ error: "Not connected to GitHub." });

  const repoFullName = String(req.query?.repo || "");
  const artifactId = Number(req.query?.artifactId || 0);
  if (!repoFullName.includes("/")) return res.status(400).json({ error: "Repository is required." });
  if (!Number.isInteger(artifactId) || artifactId <= 0) return res.status(400).json({ error: "Artifact is required." });

  const [owner, repo] = repoFullName.split("/", 2);
  try {
    const artifact = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/artifacts/${artifactId}`,
      session.accessToken
    );
    if (artifact.expired) return res.status(410).json({ error: "This APK artifact has expired." });

    const response = await fetch(artifact.archive_download_url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${session.accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
    if (!response.ok) return res.status(response.status).json({ error: "Could not download the APK artifact." });

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="web2apk-apk.zip"');
    res.status(200).end(buffer);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "APK download failed." });
  }
}
