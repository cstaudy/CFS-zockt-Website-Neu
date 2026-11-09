import { getPool } from "./db.js";
import { currentAccount, isAdminEmail } from "./auth.js";

const kinds = new Set(["widget", "scene", "stream", "cut", "audio", "design"]);
const statuses = new Set(["draft", "private", "published", "archived"]);

function accountView(account) {
  if (!account) return null;
  return { ...account, admin: isAdminEmail(account.email), email_verified: Boolean(account.email_verified_at) };
}

export async function requireAccount(req) {
  const account = accountView(await currentAccount(req));
  return account;
}

export async function requireAdmin(req) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!account.admin) return { error: "ADMIN_ACCESS_REQUIRED", status: 403 };
  return account;
}

export async function listProjects(req, url) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const pool = getPool();
  const kind = url.searchParams.get("kind");
  const values = [account.id];
  let filter = "";
  if (kind && kinds.has(kind)) { values.push(kind); filter = ` and kind = $${values.length}`; }
  const result = await pool.query(`select id, kind, name, data, status, created_at, updated_at from creator_projects where account_id = $1${filter} and status <> 'archived' order by updated_at desc`, values);
  return { projects: result.rows };
}

export async function createProject(req, body) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const kind = String(body.kind || "");
  const name = String(body.name || "").trim();
  if (!kinds.has(kind)) return { error: "INVALID_PROJECT_KIND", status: 400 };
  if (!name || name.length > 160) return { error: "INVALID_PROJECT_NAME", status: 400 };
  const result = await getPool().query("insert into creator_projects (account_id, kind, name, data) values ($1, $2, $3, $4::jsonb) returning id, kind, name, data, status, created_at, updated_at", [account.id, kind, name, JSON.stringify(body.data || {})]);
  return { project: result.rows[0] };
}

export async function updateProject(req, id, body) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const fields = [];
  const values = [id, account.id];
  if (body.name !== undefined) { const name = String(body.name).trim(); if (!name || name.length > 160) return { error: "INVALID_PROJECT_NAME", status: 400 }; values.push(name); fields.push(`name = $${values.length}`); }
  if (body.data !== undefined) { values.push(JSON.stringify(body.data || {})); fields.push(`data = $${values.length}::jsonb`); }
  if (body.status !== undefined) { if (!statuses.has(String(body.status))) return { error: "INVALID_PROJECT_STATUS", status: 400 }; values.push(String(body.status)); fields.push(`status = $${values.length}`); }
  if (!fields.length) return { error: "NO_CHANGES", status: 400 };
  fields.push("updated_at = now()");
  const result = await getPool().query(`update creator_projects set ${fields.join(", ")} where id = $1 and account_id = $2 returning id, kind, name, data, status, created_at, updated_at`, values);
  return result.rows[0] ? { project: result.rows[0] } : { error: "PROJECT_NOT_FOUND", status: 404 };
}

export async function deleteProject(req, id) {
  return updateProject(req, id, { status: "archived" });
}

