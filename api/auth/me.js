import { getSession } from "../_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const session = await getSession(req);
  if (!session) return res.status(401).json({ authenticated: false });
  res.status(200).json({
    authenticated: true,
    user: { login: session.login, name: session.name, avatar: session.avatar },
  });
}