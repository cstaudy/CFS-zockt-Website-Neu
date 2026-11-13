import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import { createWidget } from "./widget-adapter.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PACKAGE_BYTES = 512 * 1024;

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
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "INVALID_WIDGET_PACKAGE", status: 400 };
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim() || body.name.length > 160)) return { error: "INVALID_PACKAGE_NAME", status: 400 };
  if (body.world !== undefined && (typeof body.world !== "string" || body.world.length > 120)) return { error: "INVALID_PACKAGE_WORLD", status: 400 };
  if (body.color !== undefined && (typeof body.color !== "string" || body.color.length > 80)) return { error: "INVALID_PACKAGE_COLOR", status: 400 };
  if (body.outputs !== undefined && (!Array.isArray(body.outputs) || body.outputs.length > 8 ||
      body.outputs.some(output => typeof output !== "string" || !/^[a-z0-9_-]{1,40}$/.test(output)))) return { error: "INVALID_PACKAGE_OUTPUTS", status: 400 };
  const name = body.name?.trim() || "Mein Widget-Paket";
  const pack = { type: "widget_package", world: body.world || "", color: body.color || "",
    outputs: body.outputs || ["widgets", "overlays"], preview: body.preview ?? null };
  const serialized = JSON.stringify({ type: "widget_package", package: pack });
  if (Buffer.byteLength(serialized, "utf8") > MAX_PACKAGE_BYTES) return { error: "WIDGET_PACKAGE_TOO_LARGE", status: 413 };
  const result = await getPool().query("insert into creator_projects (account_id, kind, name, data) values ($1, 'design', $2, $3::jsonb) returning id, name, data, status, version, created_at, updated_at", [account.id, name, serialized]);
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
  if (!UUID.test(String(id))) return { error: "BUNDLE_NOT_FOUND", status: 404 };
  const pool = getPool();
  const found = await pool.query("select id, name, data from creator_projects where id = $1 and account_id = $2 and kind = 'design' and data->>'type' = 'widget_package' and status <> 'archived'", [id, account.id]);
  const row = found.rows[0];
  if (!row) return { error: "BUNDLE_NOT_FOUND", status: 404 };
  const outputs = Array.isArray(row.data?.package?.outputs) ? row.data.package.outputs : ["widgets"];
  const created = [];
  if (outputs.includes("widgets")) {
    // Widget quotas and initial schema are enforced by the dedicated API.
    // Do not insert creator_projects directly from a bundle conversion.
    const world = String(row.data?.package?.world || "cfs-standard");
    const templateKey = world.replace(/[^a-z0-9_-]/gi, "-").slice(0, 80) || "cfs-standard";
    const result = await createWidget(req, {
      widget_type: "follower_goal", template_key: templateKey,
      name: `${row.name} · Widget`.slice(0, 160)
    });
    if (result.error) return result;
    created.push({ id: result.widget.id, name: result.widget.name, type: "widget" });
  }
  return { message: "Bundle wurde für das Widget Studio vorbereitet.", created_widgets: created, summary: { created: created.length, existing: 0 } };
}
