import { GoogleGenAI } from "@google/genai";
import { githubRequest } from "../_lib/github.js";
import { getSession } from "../_lib/session.js";

const MAX_FILES = 25;
const MAX_FILE_CHARS = 12000;

function textFromFile(file) {
  if (!file || file.type !== "file" || !file.content) return "";
  try {
    return Buffer.from(file.content, "base64").toString("utf8").slice(0, MAX_FILE_CHARS);
  } catch {
    return "";
  }
}

async function collectFiles(owner, repo, path, token, output, depth = 0) {
  if (output.length >= MAX_FILES || depth > 2) return;
  const items = await githubRequest(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path ? encodeURIComponent(path).replace(/%2F/g, "/") : ""}`,
    token
  );
  if (!Array.isArray(items)) return;

  for (const item of items) {
    if (output.length >= MAX_FILES) break;
    if (item.type === "file") {
      const important = /(^|\/)(package\.json|vite\.config\.|next\.config\.|nuxt\.config\.|angular\.json|astro\.config\.|src\/|public\/)/i.test(item.path);
      if (!important && path === "") continue;
      const file = await githubRequest(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${item.path.split("/").map(encodeURIComponent).join("/")}`,
        token
      );
      const text = textFromFile(file);
      if (text) output.push({ path: item.path, content: text });
    } else if (item.type === "dir") {
      await collectFiles(owner, repo, item.path, token, output, depth + 1);
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getSession(req);
  if (!session?.accessToken) return res.status(401).json({ error: "Not connected to GitHub." });

  const { fullName, branch } = req.body || {};
  if (!fullName || !fullName.includes("/")) {
    return res.status(400).json({ error: "A GitHub repository is required." });
  }

  const [owner, repo] = fullName.split("/", 2);

  try {
    const repository = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, session.accessToken);
    const files = [];
    await collectFiles(owner, repo, "", session.accessToken, files);

    const packageFile = files.find(f => f.path === "package.json");
    const packageJson = packageFile ? (() => { try { return JSON.parse(packageFile.content); } catch { return null; } })() : null;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        source: "github",
        analysis: {
          framework: packageJson?.dependencies?.vite ? "Vite" : packageJson?.dependencies?.next ? "Next.js" : "Unknown",
          buildCommand: packageJson?.scripts?.build || "npm run build",
          outputDirectory: "dist",
          packageManager: "npm",
          capacitorReady: false,
          summary: "Gemini API key is not configured yet. Basic project detection was completed from package.json."
        },
        filesInspected: files.map(f => f.path)
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Analyze this GitHub web project for conversion into an Android APK using Capacitor. Return ONLY valid JSON with keys: framework, buildCommand, outputDirectory, packageManager, capacitorReady, requiredChanges, summary. Do not invent files or commands. Prefer package.json scripts and actual config files.\n\nRepository: ${fullName}\nDefault branch: ${branch || repository.default_branch}\nFiles:\n${files.map(f => `--- ${f.path} ---\\n${f.content}`).join("\n")}`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const raw = response.text || "{}";
    let analysis;
    try { analysis = JSON.parse(raw); } catch { throw new Error("Gemini returned invalid JSON."); }

    res.status(200).json({ source: "github+gemini", analysis, filesInspected: files.map(f => f.path) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Repository analysis failed." });
  }
}
