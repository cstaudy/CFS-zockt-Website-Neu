// TikTok refresh rotation: use the existing encrypted connection row and
// serialize refreshes across server instances. No scope expansion or publishing.
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const text = value => typeof value === "string" && value.trim().length > 0 && value.length <= 16384;
const seconds = value => Number.isSafeInteger(value) && value > 0 && value <= 366 * 86400;
const expiry = value => value == null ? NaN : new Date(value).getTime();
const fail = (error, status) => ({ error, status });
const validScopes = value => typeof value === "string" && value.length <= 4096 &&
  value.split(",").every(s => /^[a-zA-Z0-9_.]+$/.test(s.trim()));
export function normalizeTikTokGrant(grant, expectedOpenId) {
  if (!grant || !text(grant.access_token) || !text(grant.refresh_token) ||
      !text(grant.open_id) || (expectedOpenId !== undefined && grant.open_id !== expectedOpenId) ||
      !seconds(grant.expires_in) || !seconds(grant.refresh_expires_in) ||
      !validScopes(grant.scope) || String(grant.token_type).toLowerCase() !== "bearer")
    return null;
  return { access_token: grant.access_token, refresh_token: grant.refresh_token,
    open_id: grant.open_id, expires_in: grant.expires_in,
    refresh_expires_in: grant.refresh_expires_in, scope: grant.scope };
}

// This helper is for authenticated server-side actions, not public status,
// scheduled uploads or the public feed. Never return tokens to an HTTP client.
export async function getTikTokAccess({ pool, accountId, open, seal, env,
    fetchImpl = globalThis.fetch, now = Date.now() }) {
  if (!accountId || !pool || !env?.TIKTOK_CLIENT_KEY || !env?.TIKTOK_CLIENT_SECRET ||
      !env?.SESSION_SECRET) return fail("TIKTOK_NOT_CONFIGURED", 503);
  let client;
  let inTransaction = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    inTransaction = true;
    // A bounded lock wait avoids accumulating refresh requests.
    await client.query("SET LOCAL lock_timeout = '8s'");
    const row = (await client.query(
      "select open_id,access_token,refresh_token,expires_at,refresh_expires_at,scope from tiktok_connections where account_id=$1 for update",
      [accountId])).rows[0];
    const finish = async result => {
      await client.query("COMMIT"); inTransaction = false; return result;
    };
    if (!row) return await finish(fail("TIKTOK_NOT_CONNECTED", 404));
    const access = open(row.access_token);
    if (access && expiry(row.expires_at) > now + 60000)
      return await finish({ access, scope: row.scope });
    const refresh = open(row.refresh_token);
    if (!refresh || !Number.isFinite(expiry(row.refresh_expires_at)) ||
        expiry(row.refresh_expires_at) <= now)
      return await finish(fail("TIKTOK_RECONNECT_REQUIRED", 409));
    let response, body;
    try {
      response = await fetchImpl(TOKEN_URL, { method: "POST", redirect: "error",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY,
          client_secret: env.TIKTOK_CLIENT_SECRET, grant_type: "refresh_token",
          refresh_token: refresh }), signal: AbortSignal.timeout(6000) });
      body = await response.json();
    } catch { return await finish(fail("TIKTOK_REFRESH_UNAVAILABLE", 502)); }
    if (!response.ok || body?.error) {
      const reconnect = body?.error === "invalid_grant";
      return await finish(fail(reconnect ? "TIKTOK_RECONNECT_REQUIRED" : "TIKTOK_REFRESH_UNAVAILABLE", reconnect ? 409 : 502));
    }
    const grant = normalizeTikTokGrant(body, row.open_id);
    if (!grant) return await finish(fail("TIKTOK_REFRESH_RESPONSE_INVALID", 502));
    const updated = await client.query(
      "update tiktok_connections set access_token=$2,refresh_token=$3,expires_at=now()+($4::integer * interval '1 second'),refresh_expires_at=now()+($5::integer * interval '1 second'),scope=$6,updated_at=now() where account_id=$1",
      [accountId, seal(grant.access_token), seal(grant.refresh_token), grant.expires_in,
        grant.refresh_expires_in, grant.scope]);
    if (updated.rowCount !== 1) throw new Error("TIKTOK_REFRESH_PERSISTENCE_FAILED");
    return await finish({ access: grant.access_token, scope: grant.scope });
  } catch {
    if (inTransaction) await client.query("ROLLBACK").catch(() => {});
    return fail("TIKTOK_REFRESH_UNAVAILABLE", 502);
  } finally { client?.release(); }
}
