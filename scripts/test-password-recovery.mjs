import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mailStatus, sendMail } from "../src/mail.js";

const original = { ...process.env };
try {
  delete process.env.RESEND_API_KEY;
  delete process.env.MAIL_FROM;
  delete process.env.APP_BASE_URL;
  assert.equal(mailStatus().password_recovery_available, false);

  process.env.RESEND_API_KEY = "test-only";
  process.env.MAIL_FROM = "no-reply@example.test";
  process.env.APP_BASE_URL = "http://evil.example";
  assert.equal(mailStatus().password_recovery_available, false, "Remote HTTP origins must be rejected");

  process.env.APP_BASE_URL = "https://cfs-zockt.example";
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true };
  };
  assert.equal(mailStatus().password_recovery_available, true);
  assert.equal(await sendMail({ to: "synthetic@example.test", token: "synthetic-token", type: "recovery" }), true);
  const body = JSON.parse(request.options.body);
  assert.match(body.html, /https:\/\/cfs-zockt\.example\/pages\/reset-password\.html#token=synthetic-token/);
  assert.doesNotMatch(body.html, /reset-password\.html\?token=/);

  const auth = await readFile(new URL("../src/auth.js", import.meta.url), "utf8");
  assert.match(auth, /password_recovery_attempts/);
  assert.match(auth, /pg_advisory_xact_lock/);
  assert.match(auth, /for update/);
  assert.match(auth, /SESSION_SECRET/);
  const migration = await readFile(new URL("../migrations/026_password_recovery_rate_limit.sql", import.meta.url), "utf8");
  assert.match(migration, /password_recovery_attempts/);
  assert.match(migration, /ip_hash/);

  const forgot = await readFile(new URL("../pages/forgot-password.html", import.meta.url), "utf8");
  const reset = await readFile(new URL("../pages/reset-password.html", import.meta.url), "utf8");
  const resetJs = await readFile(new URL("../assets/js/page-reset-password.js", import.meta.url), "utf8");
  assert.match(forgot, /autocomplete="email"/);
  assert.match(reset, /autocomplete="new-password"/);
  assert.match(reset, /aria-live="polite"/);
  assert.match(resetJs, /location\.hash/);
  assert.match(resetJs, /history\.replaceState/);
  console.log("Password recovery contract passed: safe origin, fragment token, atomic/rate-limited server contract and mobile form semantics.");
} finally {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  for (const [key, value] of Object.entries(original)) process.env[key] = value;
}
