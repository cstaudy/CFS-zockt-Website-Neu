// Read-only, account-scoped capabilities. No tokens, provider calls or publishing.
const definitions = Object.freeze([
  { provider: "tiktok", oauth: true, live: "official_access_required", publish: "planned", readScopes: ["user.info.basic"], uploadScopes: ["video.upload"], publishScopes: ["video.publish"] },
  { provider: "twitch", oauth: true, live: "runtime_acceptance_required", publish: "not_supported", readScopes: ["user:read:email"], liveScopes: ["channel:read:stream_key"] },
  { provider: "youtube", oauth: false, live: "planned", publish: "planned" },
  { provider: "instagram", oauth: false, live: "not_supported", publish: "planned" },
  { provider: "facebook", oauth: false, live: "manual_setup", publish: "planned" },
  { provider: "kick", oauth: false, live: "manual_setup", publish: "not_supported" },
  { provider: "custom_rtmp", oauth: false, live: "manual_setup", publish: "not_supported" }
]);

function connectionMetadata(row, now) {
  if (!row) return { connection: "not_connected", token_status: "not_connected", scopes: new Set() };
  const expiry = row.expires_at == null ? NaN : new Date(row.expires_at).getTime();
  const scopes = new Set(typeof row.scope === "string" ? row.scope.split(/[\s,]+/).filter(Boolean) : []);
  return { connection: "record_present", token_status: !Number.isFinite(expiry) ? "expiry_unknown" :
    expiry <= now ? "expired" : "not_expired_unverified", scopes };
}

function scopeState(required, scopes) {
  return required?.length ? required.every(scope => scopes.has(scope)) : null;
}

export function buildProviderCapabilities(rows, configured = {}, now = Date.now()) {
  if (!Array.isArray(rows) || !Number.isFinite(now)) throw new Error("INVALID_PROVIDER_METADATA");
  const byProvider = new Map();
  for (const row of rows) {
    if (!row || !["tiktok", "twitch"].includes(row.provider) || byProvider.has(row.provider))
      throw new Error("INVALID_PROVIDER_METADATA");
    byProvider.set(row.provider, row);
  }
  return definitions.map(def => {
    const row = byProvider.get(def.provider);
    const metadata = connectionMetadata(row, now);
    const appConfigured = def.oauth && configured[def.provider] === true;
    return {
      provider: def.provider,
      oauth_implemented: def.oauth,
      configured: appConfigured,
      connection: def.oauth ? metadata.connection : "not_implemented",
      token_status: def.oauth ? metadata.token_status : "not_implemented",
      read: { scope_recorded: scopeState(def.readScopes, metadata.scopes), verified: false },
      live: { status: def.live, scope_recorded: scopeState(def.liveScopes, metadata.scopes), ready: false },
      publishing: { status: def.publish, upload_scope_recorded: scopeState(def.uploadScopes, metadata.scopes),
        publish_scope_recorded: scopeState(def.publishScopes, metadata.scopes), ready: false }
    };
  });
}

// Reuse the existing connection tables and their account ownership.
// Select only expiry and scope metadata; never read profile IDs or token columns.
export async function readProviderCapabilities(db, accountId, configured, now = Date.now()) {
  if (typeof accountId !== "string" || !accountId || !db || typeof db.query !== "function")
    throw new Error("PROVIDER_ACCOUNT_REQUIRED");
  const result = await db.query(
    "select 'tiktok' as provider, scope, expires_at from tiktok_connections where account_id=$1 " +
    "union all select 'twitch' as provider, scope, expires_at from twitch_connections where account_id=$1",
    [accountId]
  );
  return buildProviderCapabilities(result?.rows, configured, now);
}
