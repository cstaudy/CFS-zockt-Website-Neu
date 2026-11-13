import { getPool } from "./db.js";
import { currentAccount, isAdminEmail } from "./auth.js";

const kinds = new Set(["widget", "scene", "stream", "cut", "audio", "design"]);
const statuses = new Set(["draft", "private", "published", "archived"]);
const validData = value => value !== null && typeof value === "object" && !Array.isArray(value);
const MAX_PROJECT_DATA_BYTES = 512 * 1024;
function projectData(value) {
  if (!validData(value)) return null;
  const serialized = JSON.stringify(value);
  return serialized && Buffer.byteLength(serialized, "utf8") <= MAX_PROJECT_DATA_BYTES ? serialized : null;
}

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
  if (kind && !kinds.has(kind)) return { error: "INVALID_PROJECT_KIND", status: 400 };
  if (kind) { values.push(kind); filter = ` and kind = $${values.length}`; }
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
  const data = projectData(body.data ?? {});
  if (data === null) return { error: "INVALID_PROJECT_DATA", status: 400 };
  const result = await getPool().query("insert into creator_projects (account_id, kind, name, data) values ($1, $2, $3, $4::jsonb) returning id, kind, name, data, status, created_at, updated_at", [account.id, kind, name, data]);
  return { project: result.rows[0] };
}

export async function updateProject(req, id, body) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const fields = [];
  const values = [id, account.id];
  if (body.name !== undefined) { const name = String(body.name).trim(); if (!name || name.length > 160) return { error: "INVALID_PROJECT_NAME", status: 400 }; values.push(name); fields.push(`name = $${values.length}`); }
  if (body.data !== undefined) { const data = projectData(body.data); if (data === null) return { error: "INVALID_PROJECT_DATA", status: 400 }; values.push(data); fields.push(`data = $${values.length}::jsonb`); }
  if (body.status !== undefined) { if (!statuses.has(String(body.status))) return { error: "INVALID_PROJECT_STATUS", status: 400 }; values.push(String(body.status)); fields.push(`status = $${values.length}`); }
  if (!fields.length) return { error: "NO_CHANGES", status: 400 };
  fields.push("updated_at = now()");
  // Enforce the widget restriction in the UPDATE itself to prevent a check/write race.
  const widgetRestricted = body.data !== undefined || (body.status !== undefined && body.status !== "archived");
  const restriction = widgetRestricted ? " and kind <> 'widget'" : "";
  const result = await getPool().query(`update creator_projects set ${fields.join(", ")} where id = $1 and account_id = $2${restriction} returning id, kind, name, data, status, created_at, updated_at`, values);
  if (result.rows[0]) return { project: result.rows[0] };
  if (widgetRestricted) {
    const existing = (await getPool().query("select kind from creator_projects where id=$1 and account_id=$2", [id, account.id])).rows[0];
    if (existing?.kind === "widget") return { error: "USE_WIDGET_STUDIO_API", status: 409 };
  }
  return { error: "PROJECT_NOT_FOUND", status: 404 };
}

export async function deleteProject(req, id) {
  return updateProject(req, id, { status: "archived" });
}
