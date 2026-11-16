// GET /api/creator/media/{videos,clips} already advertises 500 items.
// Enforce the limit on each folder's INSERT, including concurrent requests.
export const mediaQuota = Object.freeze({ max_items: 500 });

export function mediaQuotaViolation(count) {
  // PostgreSQL COUNT may arrive as a string; malformed/unsafe values must
  // never be interpreted as an available quota slot.
  if (!["number", "string", "bigint"].includes(typeof count) ||
      (typeof count === "number" && !Number.isSafeInteger(count)) ||
      !/^(0|[1-9][0-9]*)$/.test(String(count))) {
    return "MEDIA_QUOTA_UNAVAILABLE";
  }
  return BigInt(count) >= BigInt(mediaQuota.max_items)
    ? "MEDIA_LIMIT_REACHED" : null;
}

function quotaError(code, status) {
  return Object.assign(new Error(code), { code, status });
}

/**
 * Serialize a creator's uploads through the existing accounts row lock.
 * The folder-specific count and INSERT happen in one transaction.
 * storeUploadWithRecord() removes newly written bytes on any rejection.
 * No live database schema or migration changes are required.
 */
export async function registerMediaWithinQuota(pool, accountId, fields) {
  if (!Number.isSafeInteger(fields?.size) || fields.size <= 0) {
    throw quotaError("INVALID_MEDIA_SIZE", 413);
  }
  if (!["videos", "clips"].includes(fields?.folder)) {
    throw quotaError("INVALID_MEDIA_FOLDER", 400);
  }

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
      "select count(*)::text as count from user_media where account_id=$1 and folder=$2",
      [accountId, fields.folder]
    );
    const violation = mediaQuotaViolation(usage.rows?.[0]?.count);
    if (violation) {
      throw quotaError(violation, violation === "MEDIA_LIMIT_REACHED" ? 402 : 503);
    }

    const inserted = await client.query(
      "insert into user_media(account_id,folder,name,mime_type,size_bytes," +
      "storage_path,duration_ms,metadata) " +
      "values($1,$2,$3,$4,$5,$6,$7,$8::jsonb) " +
      "returning id,folder,name,mime_type,size_bytes,storage_path,duration_ms," +
      "metadata,created_at,updated_at",
      [accountId, fields.folder, fields.name, fields.mime, fields.size,
        fields.stored, fields.durationMs, fields.metadata]
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
