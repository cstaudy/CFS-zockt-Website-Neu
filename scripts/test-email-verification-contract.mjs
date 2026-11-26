import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sendMail } from "../src/mail.js";

const source = await readFile(new URL("../src/email-verification.js", import.meta.url), "utf8");
assert.match(source, /used_at is null and expires_at>now\(\)/);
assert.match(source, /update email_verification_tokens set used_at=now\(\)/);
assert.match(source, /await client\.query\("BEGIN"\)/);
const savedFetch = globalThis.fetch;
const savedEnv = { ...process.env };
try {
  process.env.RESEND_API_KEY = "test-key";
  process.env.MAIL_FROM = "test@example.invalid";
  process.env.APP_BASE_URL = "https://cfs-zockt-staging.onrender.com/";
  globalThis.fetch = async () => ({ ok: false, status: 422 });
  assert.deepEqual(await sendMail({ to: "user@example.invalid", token: "test-token", type: "verification" }), { ok: false, error: "MAIL_DELIVERY_FAILED", status: 502 });
  globalThis.fetch = async (_url, options) => { assert.match(String(options.body), /verify-email\.html#token=test-token/); return { ok: true, status: 200 }; };
  assert.deepEqual(await sendMail({ to: "user@example.invalid", token: "test-token", type: "verification" }), { ok: true });
} finally {
  globalThis.fetch = savedFetch;
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
}
console.log("Email verification contract passed.");
