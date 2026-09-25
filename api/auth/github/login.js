import crypto from "node:crypto";
import { setCookie } from "../../_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: "GITHUB_CLIENT_ID is not configured." });

  const state = crypto.randomBytes(24).toString("hex");
  setCookie(res, "web2apk_oauth_state", state, 600);

  const redirectUri = process.env.GITHUB_CALLBACK_URL ||
    `${process.env.APP_URL || "http://localhost:3000"}/api/auth/github/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user repo workflow",
    state,
  });

  res.writeHead(302, { Location: `https://github.com/login/oauth/authorize?${params}` });
  res.end();
}