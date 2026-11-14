// These values are already advertised by GET /api/creator/widget-studio/assets.
// Enforce them on INSERT, not just in the frontend or the listing response.
export const assetQuota = Object.freeze({
  max_assets: 120,
  max_total_bytes: 128 * 1024 * 1024
});

export function assetQuotaViolation(count, usedBytes, incomingBytes) {
  if (BigInt(count) >= BigInt(assetQuota.max_assets)) return "ASSET_LIMIT_REACHED";
  if (BigInt(usedBytes) + BigInt(incomingBytes) > BigInt(assetQuota.max_total_bytes)) {
    return "ASSET_STORAGE_LIMIT_REACHED";
  }
  return null;
}

function quotaError(code, status) {
  return Object.assign(new Error(code), { code, status });
}

/**
 * Serialize uploads for ONE account using the existing accounts row as the
 * lock. The count, total size and INSERT run in the same DB transaction.
 * The caller wraps this in storeUploadWithRecord(), so every rejected INSERT
 * also removes its uniquely created temporary file.
 */
export async function registerAssetWithinQuota(pool, accountId, fields) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const account = await client.query(
      "select id from accounts where id=$1 for update", [accountId]
    );
    if (account.rowCount !== 1) {
      throw quotaError("AUTHENTICATION_REQUIRED", 401);
    }
    const usage = await client.query(
      "select count(*)::int as count, " +
      "coalesce(sum(greatest(size_bytes,0)),0)::text as used_bytes " +
      "from creator_assets where account_id=$1",
      [accountId]
    );
    const { count, used_bytes: usedBytes } = usage.rows[0];
    const violation = assetQuotaViolation(count, usedBytes, fields.size);
    if (violation) throw quotaError(violation, 402);

    const inserted = await client.query(
      "insert into creator_assets (account_id, name, mime_type, size_bytes, storage_path) " +
      "values ($1, $2, $3, $4, $5) returning id, name, media_type, mime_type, " +
      "size_bytes, storage_path, category, created_at",
      [accountId, fields.name, fields.mime, fields.size, fields.stored]
    );
    await client.query("COMMIT");
    return inserted;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
