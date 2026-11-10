import { currentAccount } from "./auth.js";
import { getPool } from "./db.js";

export async function publicLiveControl(req, body = null) {
  const account = await currentAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const pool = getPool();
  if (body === null) {
    const row = (await pool.query("select active,expires_at,updated_at from public_live_controls where account_id=$1", [account.id])).rows[0];
    const active = Boolean(row?.active && (!row.expires_at || new Date(row.expires_at) > new Date()));
    return { ok: true, active, expires_at: active ? row.expires_at : null, updated_at: row?.updated_at || null };
  }
  const active = body.active === true;
  const expires = active ? new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() : null;
  const row = (await pool.query("insert into public_live_controls(account_id,active,expires_at,updated_at) values($1,$2,$3,now()) on conflict(account_id) do update set active=excluded.active,expires_at=excluded.expires_at,updated_at=now() returning active,expires_at,updated_at", [account.id, active, expires])).rows[0];
  return { ok: true, active: Boolean(row.active), expires_at: row.expires_at, updated_at: row.updated_at };
}

