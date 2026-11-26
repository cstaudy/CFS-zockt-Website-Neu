import { createHash, randomBytes } from "node:crypto";
import { getPool } from "./db.js";
import { sendMail } from "./mail.js";

const hash = value => createHash("sha256").update(value).digest("hex");
const emailOf = value => String(value || "").trim().toLowerCase();

export async function requestEmailVerification(email) {
  const pool = getPool();
  if (!pool) return { error: "DATABASE_UNAVAILABLE", status: 503 };
  const row = (await pool.query("select id,email,email_verified_at from accounts where email=$1", [emailOf(email)])).rows[0];
  if (!row) return { ok: true, message: "Wenn die Adresse zu einem Konto gehoert, wurde ein Bestaetigungslink angefordert." };
  if (row.email_verified_at) return { ok: true, message: "Diese E-Mail-Adresse ist bereits bestaetigt." };
  if ((await pool.query("select 1 from email_verification_tokens where account_id=$1 and created_at>now()-interval '30 seconds' and used_at is null limit 1", [row.id])).rows[0]) return { error: "VERIFICATION_RATE_LIMITED", status: 429 };
  const token = randomBytes(32).toString("base64url"), client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("delete from email_verification_tokens where account_id=$1 or expires_at<=now()", [row.id]);
    await client.query("insert into email_verification_tokens(account_id,token_hash,expires_at) values($1,$2,now()+interval '30 minutes')", [row.id, hash(token)]);
    const sent = await sendMail({ to: row.email, token, type: "verification" });
    if (!sent.ok) { await client.query("ROLLBACK"); return { error: sent.error, status: sent.status }; }
    await client.query("COMMIT");
    return { ok: true, message: "Bestaetigungslink wurde versendet. Pruefe bitte Posteingang und Spam-Ordner." };
  } catch (error) { try { await client.query("ROLLBACK"); } catch {} throw error; }
  finally { client.release(); }
}

export async function verifyEmail(token) {
  const pool = getPool();
  if (!pool) return { error: "DATABASE_UNAVAILABLE", status: 503 };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = (await client.query("update email_verification_tokens set used_at=now() where token_hash=$1 and used_at is null and expires_at>now() returning account_id", [hash(String(token || ""))])).rows[0];
    if (!row) { await client.query("ROLLBACK"); return { error: "VERIFICATION_TOKEN_INVALID_OR_EXPIRED", status: 400 }; }
    await client.query("update accounts set email_verified_at=coalesce(email_verified_at,now()),updated_at=now() where id=$1", [row.account_id]);
    await client.query("COMMIT");
    return { ok: true, message: "E-Mail-Adresse wurde bestaetigt." };
  } catch (error) { try { await client.query("ROLLBACK"); } catch {} throw error; }
  finally { client.release(); }
}
