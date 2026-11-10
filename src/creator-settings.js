import { currentAccount } from "./auth.js";
import { getPool } from "./db.js";

export async function creatorSettings(req, body = null) {
  const account = await currentAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (body === null) {
    const row = (await getPool().query("select settings,updated_at from creator_settings where account_id=$1", [account.id])).rows[0];
    return { ok: true, settings: row?.settings || {}, updated_at: row?.updated_at || null, entitlements: { plan: account.plan || "free", admin: ["admin","owner"].includes(account.role) } };
  }
  if (!body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) return { error: "INVALID_SETTINGS", status: 400 };
  const serialized = JSON.stringify(body.settings);
  if (Buffer.byteLength(serialized, "utf8") > 60 * 1024) return { error: "SETTINGS_TOO_LARGE", status: 413 };
  const row = (await getPool().query("insert into creator_settings(account_id,settings,updated_at) values($1,$2::jsonb,now()) on conflict(account_id) do update set settings=excluded.settings,updated_at=now() returning settings,updated_at", [account.id, serialized])).rows[0];
  return { ok: true, settings: row.settings, updated_at: row.updated_at, entitlements: { plan: account.plan || "free", admin: ["admin","owner"].includes(account.role) } };
}

