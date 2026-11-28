import { buildPublishingDraft, comparePublishingIntent } from "./publisher-job-contract.js";
import { normalizePublisherPreview } from "./publisher-preview.js";

const fail = (error,status) => ({error,status});
export const MAX_PUBLISHER_DRAFTS = 50; // provisional local-development limit
// Internal adapter prototype. Not routed, not a worker, and not enabled in
// production. Requires the unregistered draft-only schema in an isolated DB.
// The caller must supply accountId from the authenticated server session.
export async function persistPublisherDraft(pool,accountId,requestId,body) {
  const proposed=buildPublishingDraft(accountId,requestId,body);
  if (proposed.error) return fail(proposed.error,400);
  const account=accountId.toLowerCase(), request=requestId.toLowerCase();
  const normalized=normalizePublisherPreview(body);
  const draft={...normalized,targets:[...normalized.targets].sort()};
  let client, transaction=false;
  try {
    client=await pool.connect();
    await client.query("BEGIN"); transaction=true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    // Same account lock used by existing export quota, but no shared job queue.
    const owner=await client.query("select id from accounts where id=$1 for update",[account]);
    const finish=async result=>{await client.query("COMMIT");transaction=false;return result;};
    if (owner.rows?.length!==1) return await finish(fail("AUTHENTICATION_REQUIRED",401));
    const media=await client.query(
      "select id,mime_type,size_bytes from user_media where id=$1 and account_id=$2 and folder in ('videos','clips') for share",
      [draft.media_id,account]);
    const row=media.rows?.[0];
    if (!row) return await finish(fail("MEDIA_NOT_FOUND",404));
    if (!/^video\/(mp4|webm|quicktime|x-matroska)$/.test(row.mime_type) ||
        !Number.isSafeInteger(Number(row.size_bytes)) || Number(row.size_bytes)<=0)
      return await finish(fail("INVALID_PUBLISHER_MEDIA",422));
    const existing=(await client.query(
      "select request_key,request_fingerprint from publisher_drafts where account_id=$1 and request_id=$2",
      [account,request])).rows?.[0];
    if (existing) {
      if (comparePublishingIntent(existing,proposed)!=="same_intent")
        return await finish(fail("PUBLISHER_REQUEST_CONFLICT",409));
      // Verify the complete existing target set; never silently repair missing
      // or inconsistent rows on replay.
      const targets=(await client.query(
        "select target,target_key,state,revision,attempts from publisher_draft_targets where account_id=$1 and request_key=$2 order by target",
        [account,proposed.request_key])).rows;
      if (!Array.isArray(targets) || targets.length!==proposed.targets.length ||
          proposed.targets.some(p=>!targets.some(t=>t.target===p.target&&t.target_key===p.key&&t.state==="draft"&&t.revision===0&&t.attempts===0)))
        throw Error("PUBLISHER_DRAFT_INTEGRITY");
      return await finish({ok:true,mode:"draft_only",can_publish:false,created:false,request_key:proposed.request_key,
        targets:proposed.targets.map(t=>({target:t.target,state:"draft"}))});
    }
    const count=(await client.query("select count(*)::int as count from publisher_drafts where account_id=$1",[account])).rows?.[0]?.count;
    if (!Number.isSafeInteger(count)||count<0) throw Error("PUBLISHER_DRAFT_COUNT_INVALID");
    if (count>=MAX_PUBLISHER_DRAFTS) return await finish(fail("PUBLISHER_DRAFT_LIMIT",429));
    const inserted=await client.query(
      "insert into publisher_drafts(request_key,account_id,request_id,request_fingerprint,media_id,draft) values($1,$2,$3,$4,$5,$6::jsonb)",
      [proposed.request_key,account,request,proposed.request_fingerprint,draft.media_id,JSON.stringify(draft)]);
    if (inserted.rowCount!==1) throw Error("PUBLISHER_DRAFT_INSERT_FAILED");
    for (const t of proposed.targets) {
      const target=await client.query(
        "insert into publisher_draft_targets(target_key,account_id,request_key,target) values($1,$2,$3,$4)",
        [t.key,account,proposed.request_key,t.target]);
      if (target.rowCount!==1) throw Error("PUBLISHER_TARGET_INSERT_FAILED");
    }
    return await finish({ok:true,mode:"draft_only",can_publish:false,created:true,request_key:proposed.request_key,
      targets:proposed.targets.map(t=>({target:t.target,state:"draft"}))});
  } catch {
    if (transaction) await client.query("ROLLBACK").catch(()=>{});
    return fail("PUBLISHER_DRAFT_UNAVAILABLE",503);
  } finally {client?.release();}
}
