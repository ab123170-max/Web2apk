import { githubRequest } from "../_lib/github.js";
import { getSession } from "../_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const session = await getSession(req);
  if (!session?.accessToken) return res.status(401).json({ error: "Not connected to GitHub." });

  try {
    const repos = await githubRequest(
      "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
      session.accessToken
    );
    res.status(200).json({
      repos: repos.map(r => ({
        id: r.id,
        fullName: r.full_name,
        name: r.name,
        private: r.private,
        defaultBranch: r.default_branch,
        description: r.description,
        htmlUrl: r.html_url,
        language: r.language,
      })),
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}