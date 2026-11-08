import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getPool } from "./db.js";

const scrypt = promisify(scryptCallback);
const sessionDays = 30;
export const ADMIN_EMAIL = "cstaudygaming@googlemail.com";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isAdminEmail(value) {
  return normalizeEmail(value) === ADMIN_EMAIL;
}

function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return scrypt(String(password), salt, 64).then(key => `scrypt$${salt}$${Buffer.from(key).toString("hex")}`);
}

async function verifyPassword(password, stored) {
  const [scheme, salt, expectedHex] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const actual = Buffer.from(await scrypt(String(password), salt, 64));
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function sessionFromRequest(req) {
  const raw = String(req.headers.cookie || "");
  const row = raw.split(";").map(x => x.trim()).find(x => x.startsWith("cfs_session="));
  return row ? row.slice("cfs_session=".length) : "";
}

export async function register({ email, password, display_name }) {
  const pool = getPool();
  if (!pool) return { error: "DATABASE_UNAVAILABLE", status: 503 };
  const normalized = normalizeEmail(email);
  const name = String(display_name || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) return { error: "INVALID_EMAIL", status: 400 };
  if (String(password || "").length < 15) return { error: "PASSWORD_TOO_SHORT", status: 400 };
  if (name.length < 2 || name.length > 80) return { error: "INVALID_DISPLAY_NAME", status: 400 };
  const hash = await passwordHash(password);
  try {
    const result = await pool.query("insert into accounts (email, password_hash, display_name) values ($1, $2, $3) returning id, email, display_name, role, plan, created_at", [normalized, hash, name]);
    return { account: result.rows[0] };
  } catch (error) {
    if (error.code === "23505") return { error: "EMAIL_ALREADY_REGISTERED", status: 409 };
    throw error;
  }
}

export async function login({ email, password }) {
  const pool = getPool();
  if (!pool) return { error: "DATABASE_UNAVAILABLE", status: 503 };
  const result = await pool.query("select id, email, display_name, role, plan, password_hash, created_at from accounts where email = $1", [normalizeEmail(email)]);
  const account = result.rows[0];
  if (!account || !account.password_hash || !(await verifyPassword(password, account.password_hash))) return { error: "INVALID_CREDENTIALS", status: 401 };
  const token = randomBytes(32).toString("base64url");
  await pool.query("insert into sessions (account_id, token_hash, expires_at) values ($1, $2, now() + ($3 || ' days')::interval)", [account.id, tokenHash(token), String(sessionDays)]);
  delete account.password_hash;
  account.role = isAdminEmail(account.email) ? "admin" : "creator";
  return { account, token, maxAge: sessionDays * 86400 };
}

export async function currentAccount(req) {
  const token = sessionFromRequest(req);
  const pool = getPool();
  if (!token || !pool) return null;
  const result = await pool.query("select a.id, a.email, a.display_name, a.role, a.plan, a.email_verified_at, a.created_at from sessions s join accounts a on a.id = s.account_id where s.token_hash = $1 and s.expires_at > now()", [tokenHash(token)]);
  if (!result.rows[0]) return null;
  await pool.query("update sessions set last_seen_at = now() where token_hash = $1", [tokenHash(token)]);
  const account = result.rows[0];
  account.role = isAdminEmail(account.email) ? "admin" : "creator";
  return account;
}

export async function logout(req) {
  const token = sessionFromRequest(req);
  const pool = getPool();
  if (token && pool) await pool.query("delete from sessions where token_hash = $1", [tokenHash(token)]);
  return cookie("cfs_session", "", 0);
}

export { cookie };

