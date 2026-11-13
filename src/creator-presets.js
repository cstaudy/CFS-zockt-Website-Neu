import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";

const KINDS = ["caption", "export", "scene"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PRESET_BYTES = 64 * 1024;
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

function view(row) {
  return { id: row.id, kind: row.kind, name: row.name, data: row.data || {},
    created_at: row.created_at, updated_at: row.updated_at };
}
export async function listPresets(req, kind) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (kind !== undefined && !KINDS.includes(kind)) return { error: "INVALID_PRESET_KIND", status: 400 };
  const result = await getPool().query(
    `select id,kind,name,data,created_at,updated_at from creator_presets where account_id=$1${kind ? " and kind=$2" : ""} order by kind,name`,
    kind ? [account.id, kind] : [account.id]
  );
  return { ok: true, presets: result.rows.map(view), kinds: KINDS };
}
export async function savePreset(req, body, id = null) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!isObject(body)) return { error: "INVALID_PRESET_REQUEST", status: 400 };
  if (!KINDS.includes(body.kind)) return { error: "INVALID_PRESET_KIND", status: 400 };
  const name = body.name === undefined ? "Neues Preset" : body.name;
  if (typeof name !== "string" || !name.trim() || name.length > 120)
    return { error: "INVALID_PRESET_NAME", status: 400 };
  if (body.data !== undefined && !isObject(body.data))
    return { error: "INVALID_PRESET_DATA", status: 400 };
  if (id && !UUID.test(String(id))) return { error: "PRESET_NOT_FOUND", status: 404 };
  if (body.expected_updated_at !== undefined &&
      (typeof body.expected_updated_at !== "string" ||
       !Number.isFinite(Date.parse(body.expected_updated_at)))) {
    return { error: "INVALID_PRESET_REVISION", status: 400 };
  }
  const serialized = JSON.stringify(body.data ?? {});
  if (Buffer.byteLength(serialized, "utf8") > MAX_PRESET_BYTES)
    return { error: "PRESET_DATA_TOO_LARGE", status: 413 };
  const pool = getPool();
  try {
    if (id) {
      const result = await pool.query(
        `update creator_presets set kind=$3,name=$4,data=$5::jsonb,
         updated_at=greatest(clock_timestamp(),updated_at + interval '1 millisecond')
         where id=$1 and account_id=$2
         ${body.expected_updated_at === undefined ? "" : "and date_trunc('milliseconds', updated_at)=$6::timestamptz"}
         returning id,kind,name,data,created_at,updated_at`,
        [id, account.id, body.kind, name.trim(), serialized,
          ...(body.expected_updated_at === undefined ? [] : [body.expected_updated_at])]
      );
      if (result.rows[0]) return { ok: true, preset: view(result.rows[0]) };
      if (body.expected_updated_at !== undefined) {
        const existing = await pool.query("select 1 from creator_presets where id=$1 and account_id=$2", [id, account.id]);
        if (existing.rows[0]) return { error: "PRESET_VERSION_CONFLICT", status: 409 };
      }
      return { error: "PRESET_NOT_FOUND", status: 404 };
    }
    const result = await pool.query(
      "insert into creator_presets(account_id,kind,name,data) values($1,$2,$3,$4::jsonb) returning id,kind,name,data,created_at,updated_at",
      [account.id, body.kind, name.trim(), serialized]
    );
    return { ok: true, preset: view(result.rows[0]) };
  } catch (error) {
    if (error.code === "23505") return { error: "PRESET_NAME_EXISTS", status: 409 };
    throw error;
  }
}
export async function deletePreset(req, id) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!UUID.test(String(id))) return { error: "PRESET_NOT_FOUND", status: 404 };
  const result = await getPool().query(
    "delete from creator_presets where id=$1 and account_id=$2 returning id", [id, account.id]
  );
  return result.rowCount ? { ok: true, deleted: true } : { error: "PRESET_NOT_FOUND", status: 404 };
}
