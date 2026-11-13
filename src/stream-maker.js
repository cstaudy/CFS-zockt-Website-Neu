import { createHmac } from "node:crypto";
import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import "../assets/js/stream-maker-core.js";

const maker = globalThis.StreamMaker;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES = 512 * 1024;
const MAX_BUNDLES = 24;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);

function revision(row) {
  return Number.isSafeInteger(row?.data?.public_token_revision) && row.data.public_token_revision >= 1
    ? row.data.public_token_revision : 1;
}
function sourceToken(row) {
  const secret = process.env.SESSION_SECRET;
  if (typeof secret !== "string" || secret.length < 16) return null;
  return row.id + createHmac("sha256", secret)
    .update("cfs-stream-maker-obs-v1:" + row.id + ":" + revision(row))
    .digest("base64url");
}
function bundleView(row) {
  return {
    id: row.id,
    version: row.version,
    config: maker.sanitize(row.data.config),
    published: row.data.shop_published === true,
    public_token: sourceToken(row),
    updated_at: row.updated_at
  };
}

export function validateMakerConfig(value) {
  if (!object(value) || !Array.isArray(value.elements) || !value.elements.length ||
      value.elements.length > 32 || (value.variants !== undefined &&
      (!Array.isArray(value.variants) || value.variants.length > 16))) return null;
  if (value.elements.some(e => !object(e) || !maker.catalog.some(item => item.id === e.template) ||
      (e.id !== undefined && (typeof e.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(e.id))) ||
      (e.box !== undefined && !object(e.box)) || (e.cutout !== undefined && !object(e.cutout)) ||
      (e.runtime !== undefined && !object(e.runtime)))) return null;
  const suppliedIds = value.elements.filter(e => e.id !== undefined).map(e => e.id);
  if (new Set(suppliedIds).size !== suppliedIds.length) return null;
  if (value.variants?.some(v => !object(v))) return null;
  if (value.theme !== undefined && !object(value.theme)) return null;
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_BYTES) return null;
  const config = maker.sanitize(value);
  const ids = config.elements.map(e => e.id);
  if (new Set(ids).size !== ids.length) return null;
  return config;
}
async function owner(req) {
  const account = await requireAccount(req);
  return account || null;
}
async function ownerRow(pool, id, accountId) {
  if (!UUID.test(String(id))) return null;
  const found = await pool.query(
    "select id, account_id, data, version, status, updated_at from creator_projects where id=$1 and account_id=$2 and kind='stream' and data->>'type'='stream_maker' and status <> 'archived'",
    [id, accountId]
  );
  return found.rows[0] || null;
}
export async function listMakerBundles(req) {
  const account = await owner(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!sourceToken({ id: "123e4567-e89b-42d3-a456-426614174000", data: {} })) return { error: "STREAM_MAKER_SECRET_NOT_CONFIGURED", status: 503 };
  const found = await getPool().query(
    "select id, data, version, updated_at from creator_projects where account_id=$1 and kind='stream' and data->>'type'='stream_maker' and status <> 'archived' order by updated_at desc",
    [account.id]
  );
  return { bundles: found.rows.map(bundleView), admin: account.admin === true, limits: { max_bundles: MAX_BUNDLES } };
}
export async function saveMakerBundle(req, body, id = null) {
  const account = await owner(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!sourceToken({ id: "123e4567-e89b-42d3-a456-426614174000", data: {} })) return { error: "STREAM_MAKER_SECRET_NOT_CONFIGURED", status: 503 };
  const config = validateMakerConfig(body?.config);
  if (!config) return { error: "INVALID_STREAM_MAKER_CONFIG", status: 400 };
  const serialized = JSON.stringify({ type: "stream_maker", config, public_token_revision: 1, shop_published: false });
  if (Buffer.byteLength(serialized, "utf8") > MAX_BYTES) return { error: "STREAM_MAKER_TOO_LARGE", status: 413 };
  const pool = getPool();
  if (!id) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("select id from accounts where id=$1 for update", [account.id]);
      const count = await client.query(
        "select count(*)::int as count from creator_projects where account_id=$1 and kind='stream' and data->>'type'='stream_maker' and status <> 'archived'", [account.id]
      );
      if (Number(count.rows[0]?.count || 0) >= MAX_BUNDLES) {
        await client.query("ROLLBACK");
        return { error: "STREAM_MAKER_LIMIT_REACHED", status: 402 };
      }
      const inserted = await client.query(
        "insert into creator_projects (account_id, kind, name, data) values ($1, 'stream', $2, $3::jsonb) returning id, data, version, updated_at",
        [account.id, config.name || "Mein Stream-Bundle", serialized]
      );
      await client.query("COMMIT");
      return { bundle: bundleView(inserted.rows[0]) };
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally { client.release(); }
  }
  if (!Number.isSafeInteger(body.version) || body.version < 1) return { error: "INVALID_STREAM_MAKER_VERSION", status: 400 };
  const row = await ownerRow(pool, id, account.id);
  if (!row) return { error: "STREAM_MAKER_NOT_FOUND", status: 404 };
  const next = { ...row.data, config };
  const nextJson = JSON.stringify(next);
  if (Buffer.byteLength(nextJson, "utf8") > MAX_BYTES) return { error: "STREAM_MAKER_TOO_LARGE", status: 413 };
  const updated = await pool.query(
    "update creator_projects set data=$3::jsonb, name=$4, version=version+1, updated_at=now() where id=$1 and account_id=$2 and kind='stream' and data->>'type'='stream_maker' and status <> 'archived' and version=$5 returning id, data, version, updated_at",
    [id, account.id, nextJson, config.name || "Mein Stream-Bundle", body.version]
  );
  return updated.rows[0] ? { bundle: bundleView(updated.rows[0]) } : { error: "STREAM_MAKER_VERSION_CONFLICT", status: 409 };
}
export async function controlMakerBundle(req, id, body) {
  const account = await owner(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!object(body) || !/^[A-Za-z0-9_-]{1,64}$/.test(String(body.element || "")) ||
      !["start", "pause", "reset", "plus", "minus", "alert"].includes(body.action)) return { error: "INVALID_STREAM_MAKER_CONTROL", status: 400 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "select id, data, version, updated_at from creator_projects where id=$1 and account_id=$2 and kind='stream' and data->>'type'='stream_maker' and status <> 'archived' for update",
      [UUID.test(String(id)) ? id : "00000000-0000-4000-8000-000000000000", account.id]
    );
    const row = found.rows[0];
    if (!row) { await client.query("ROLLBACK"); return { error: "STREAM_MAKER_NOT_FOUND", status: 404 }; }
    const config = validateMakerConfig(row.data.config);
    const element = config?.elements.find(e => e.id === body.element);
    if (!element) { await client.query("ROLLBACK"); return { error: "STREAM_MAKER_ELEMENT_NOT_FOUND", status: 404 }; }
    maker.control(element, body.action);
    const updated = await client.query(
      "update creator_projects set data=$3::jsonb, version=version+1, updated_at=now() where id=$1 and account_id=$2 returning id, data, version, updated_at",
      [id, account.id, JSON.stringify({ ...row.data, config })]
    );
    await client.query("COMMIT");
    return { bundle: bundleView(updated.rows[0]) };
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; }
  finally { client.release(); }
}
export async function rotateMakerToken(req, id, body) {
  const account = await owner(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!Number.isSafeInteger(body?.version) || body.version < 1) return { error: "INVALID_STREAM_MAKER_VERSION", status: 400 };
  const row = await ownerRow(getPool(), id, account.id);
  if (!row) return { error: "STREAM_MAKER_NOT_FOUND", status: 404 };
  const result = await getPool().query(
    "update creator_projects set data=jsonb_set(data,'{public_token_revision}',to_jsonb($3::int),true),version=version+1,updated_at=now() where id=$1 and account_id=$2 and kind='stream' and data->>'type'='stream_maker' and status <> 'archived' and version=$4 returning id,data,version,updated_at",
    [id, account.id, revision(row) + 1, body.version]
  );
  return result.rows[0] ? { bundle: bundleView(result.rows[0]) } : { error: "STREAM_MAKER_VERSION_CONFLICT", status: 409 };
}
export async function deleteMakerBundle(req, id, body) {
  const account = await owner(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!Number.isSafeInteger(body?.version) || body.version < 1) return { error: "INVALID_STREAM_MAKER_VERSION", status: 400 };
  const row = await ownerRow(getPool(), id, account.id);
  if (!row) return { error: "STREAM_MAKER_NOT_FOUND", status: 404 };
  if (row.data.shop_published) return { error: "UNPUBLISH_STREAM_MAKER_FIRST", status: 409 };
  const done = await getPool().query(
    "update creator_projects set status='archived', version=version+1,updated_at=now() where id=$1 and account_id=$2 and kind='stream' and data->>'type'='stream_maker' and status <> 'archived' and coalesce(data->>'shop_published','false') <> 'true' and version=$3 returning id",
    [id, account.id, body.version]
  );
  return done.rows[0] ? { deleted: true } : { error: "STREAM_MAKER_VERSION_CONFLICT", status: 409 };
}
