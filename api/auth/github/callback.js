import { githubRequest } from "../../_lib/github.js";
import { clearCookie, getSession, parseCookies, saveSession } from "../../_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("Method not allowed");

  const { code, state, error } = req.query;
  if (error) return res.redirect(`/?github_error=${encodeURIComponent(error)}`);

  const cookies = parseCookies(req);
  if (!state || !cookies.web2apk_oauth_state || state !== cookies.web2apk_oauth_state) {
    return res.status(400).send("Invalid OAuth state. Please try connecting again.");
  }
  if (!code) return res.status(400).send("Missing OAuth code.");

  const redirectUri = process.env.GITHUB_CALLBACK_URL ||
    `${process.env.APP_URL || "http://localhost:3000"}/api/auth/github/callback`;

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    return res.status(502).send(tokenData.error_description || "GitHub OAuth failed.");
  }

  try {
    const user = await githubRequest("/user", tokenData.access_token);
    await saveSession(res, {
      accessToken: tokenData.access_token,
      login: user.login,
      name: user.name || user.login,
      avatar: user.avatar_url || null,
    });
    clearCookie(res, "web2apk_oauth_state");
    res.writeHead(302, { Location: "/?github=connected" });
    res.end();
  } catch (e) {
    res.status(e.status || 500).send(e.message);
  }
}