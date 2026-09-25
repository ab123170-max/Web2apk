import { githubRequest } from "../_lib/github.js";
import { getSession } from "../_lib/session.js";

function validPackageId(value) {
  return /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(value || "");
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getSession(req);
  if (!session?.accessToken) return res.status(401).json({ error: "Not connected to GitHub." });

  const { fullName, branch, appName, packageId, outputDirectory } = req.body || {};
  if (!fullName || !fullName.includes("/")) return res.status(400).json({ error: "Repository is required." });
  if (!validPackageId(packageId)) return res.status(400).json({ error: "Invalid Android package ID." });

  const [owner, repo] = fullName.split("/", 2);
  const workflowPath = ".github/workflows/web2apk-build.yml";

  try {
    const repository = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      session.accessToken
    );

    const targetBranch = branch || repository.default_branch;
    const workflow = `name: Web2APK Android Build

on:
  workflow_dispatch:
    inputs:
      app_name:
        required: true
        type: string
      package_id:
        required: true
        type: string
      output_dir:
        required: true
        type: string

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'
      - uses: android-actions/setup-android@v3
      - run: npm install --no-save @capacitor/core @capacitor/cli @capacitor/android
      - name: Create Capacitor project
        env:
          APP_NAME: \${{ inputs.app_name }}
          PACKAGE_ID: \${{ inputs.package_id }}
          OUTPUT_DIR: \${{ inputs.output_dir }}
        run: |
          npx cap init "$APP_NAME" "$PACKAGE_ID" --web-dir "$OUTPUT_DIR"
          npx cap add android
          npx cap sync android
      - name: Build debug APK
        working-directory: android
        run: ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: web2apk-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
          if-no-files-found: error
`;

    let existing = null;
    try {
      existing = await githubRequest(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(workflowPath)}?ref=${encodeURIComponent(targetBranch)}`,
        session.accessToken
      );
    } catch (e) {
      if (e.status !== 404) throw e;
    }

    const body = {
      message: "Add Web2APK Android build workflow",
      content: Buffer.from(workflow, "utf8").toString("base64"),
      branch: targetBranch
    };
    if (existing?.sha) body.sha = existing.sha;

    const saved = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(workflowPath)}`,
      session.accessToken,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );

    const workflowRef = encodePath(workflowPath);
    await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${workflowRef}/dispatches`,
      session.accessToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: targetBranch,
          inputs: {
            app_name: appName || repo,
            package_id: packageId,
            output_dir: outputDirectory || "dist"
          }
        })
      }
    );

    res.status(200).json({
      ok: true,
      repository: fullName,
      branch: targetBranch,
      workflowPath,
      commitSha: saved?.commit?.sha || null,
      message: "Android build started."
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Could not start Android build." });
  }
}
