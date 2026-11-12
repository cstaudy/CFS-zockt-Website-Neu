import { createHmac, timingSafeEqual } from "node:crypto";

// RFC 6238 / TOTP with SHA-1, six digits and a strict +/- one-step clock tolerance.
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const steps = 30;
const digits = 6;

export function decodeTotpSecret(secret) {
  const raw = String(secret || "").toUpperCase().replace(/=+$/, "");
  if (raw.length < 16 || raw.length > 128 || !/^[A-Z2-7]+$/.test(raw)) return null;
  let bits = 0;
  let carry = 0;
  const bytes = [];
  for (const char of raw) {
    carry = (carry << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((carry >> bits) & 0xff);
      carry &= (1 << bits) - 1;
    }
  }
  // No non-zero truncated bits: malformed base32 should never silently change a secret.
  if (carry !== 0 || bytes.length < 10) return null;
  return Buffer.from(bytes);
}

export function totpCode(secret, timeSeconds = Math.floor(Date.now() / 1000)) {
  const key = decodeTotpSecret(secret);
  if (!key || !Number.isSafeInteger(timeSeconds) || timeSeconds < 0) return null;
  const count = Math.floor(timeSeconds / steps);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(count));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits);
  return String(value).padStart(digits, "0");
}

export function verifyTotp(secret, submitted, timeSeconds = Math.floor(Date.now() / 1000)) {
  const input = String(submitted ?? "");
  if (!/^\d{6}$/.test(input) || !Number.isSafeInteger(timeSeconds) || timeSeconds < 0) return false;
  const secretBytes = decodeTotpSecret(secret);
  if (!secretBytes) return false;
  const step = Math.floor(timeSeconds / steps);
  for (const offset of [-1, 0, 1]) {
    if (step + offset < 0) continue;
    const expected = totpCode(secret, (step + offset) * steps);
    if (expected && timingSafeEqual(Buffer.from(input), Buffer.from(expected))) return true;
  }
  return false;
}
