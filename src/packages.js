import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";

function packageView(row) {
  return { id: row.id, name: row.name, package: row.data?.package || {}, status: row.status, version: row.version || 1, created_at: row.created_at, updated_at: row.updated_at };
}

export async function listPackages(req) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const result = await getPool().query("select id, name, data, status, version, created_at, updated_at from creator_projects where account_id = $1 and kind = 'design' and status <> 'archived' and coalesce(data->>'type','') = 'widget_package' order by updated_at desc", [account.id]);
  return { packages: result.rows.map(packageView) };
}

export async function createPackage(req, body) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const name = String(body.name || "Mein Widget-Paket").trim().slice(0, 160) || "Mein Widget-Paket";
  const pack = { type: "widget_package", world: String(body.world || ""), color: String(body.color || ""), outputs: Array.isArray(body.outputs) ? body.outputs.slice(0, 8).map(String) : ["widgets", "overlays"], preview: body.preview || null };
  const result = await getPool().query("insert into creator_projects (account_id, kind, name, data) values ($1, 'design', $2, $3::jsonb) returning id, name, data, status, version, created_at, updated_at", [account.id, name, JSON.stringify({ type: "widget_package", package: pack })]);
  return { package: packageView(result.rows[0]) };
}

