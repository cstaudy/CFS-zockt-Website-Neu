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

export async function listShopCatalog(req) {
  const result = await listPackages(req);
  if (result.error) return result;
  return { bundles: result.packages.map(item => ({ id: item.id, name: item.name, design_key: item.package.world || "CFS DESIGN", platforms: item.package.outputs || ["obs"], categories: ["bundles"], elements: item.package.outputs || [], element_count: (item.package.outputs || []).length, converter_url: `/pages/widget-studio.html?open=converter&bundle=${encodeURIComponent(item.id)}`, updated_at: item.updated_at })) };
}

export async function convertBundle(req, id) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const pool = getPool();
  const found = await pool.query("select id, name, data from creator_projects where id = $1 and account_id = $2 and kind = 'design' and status <> 'archived'", [id, account.id]);
  const row = found.rows[0];
  if (!row) return { error: "BUNDLE_NOT_FOUND", status: 404 };
  const outputs = Array.isArray(row.data?.package?.outputs) ? row.data.package.outputs : ["widgets"];
  const created = [];
  if (outputs.includes("widgets")) {
    const type = "follower_goal";
    const config = { widgetType: type, templateKey: row.data?.package?.world || "cfs-standard", canvas: { width: 620, height: 132 }, elements: [], settings: {}, data: {} };
    const widget = await pool.query("insert into creator_projects (account_id, kind, name, data) values ($1, 'widget', $2, $3::jsonb) returning id, name", [account.id, `${row.name} · Widget`, JSON.stringify({ widget_type: type, config })]);
    created.push({ id: widget.rows[0].id, name: widget.rows[0].name, type: "widget" });
  }
  return { message: "Bundle wurde für das Widget Studio vorbereitet.", created_widgets: created, summary: { created: created.length, existing: 0 } };
}
