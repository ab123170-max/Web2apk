import crypto from "node:crypto";

const COOKIE_NAME = "web2apk_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function setCookie(res, name, value, maxAge = MAX_AGE) {
  res.setHeader("Set-Cookie", `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

export function clearCookie(res, name) {
  setCookie(res, name, "", 0);
}

export function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(raw.split(";").filter(Boolean).map(part => {
    const i = part.indexOf("=");
    return [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1))];
  }));
}

export async function encrypt(value) {
  const key = secretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export async function decrypt(value) {
  try {
    const raw = Buffer.from(value, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

export async function getSession(req) {
  const cookies = parseCookies(req);
  return cookies[COOKIE_NAME] ? decrypt(cookies[COOKIE_NAME]) : null;
}

export async function saveSession(res, session) {
  setCookie(res, COOKIE_NAME, await encrypt(session));
}