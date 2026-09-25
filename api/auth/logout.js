import { clearCookie } from "../_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  clearCookie(res, "web2apk_session");
  res.status(200).json({ ok: true });
}