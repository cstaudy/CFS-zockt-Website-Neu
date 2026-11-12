import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const scheme = "scrypt";
const legacyPattern = /^[A-F0-9]{10}$/;
const currentPattern = /^[A-F0-9]{20}$/;

export function generateRecoveryCodes() {
  // 80 random bits per code; previously issued ten-hex-digit codes stay valid.
  return Array.from({ length: 8 }, () => randomBytes(10).toString("hex").toUpperCase());
}

export async function hashRecoveryCode(code) {
  if (!currentPattern.test(String(code))) throw new Error("INVALID_RECOVERY_CODE");
  const salt = randomBytes(16).toString("hex");
  const digest = await scrypt(code, salt, 32);
  return `${scheme}$${salt}$${Buffer.from(digest).toString("hex")}`;
}

export async function hashRecoveryCodes(codes) {
  const result = [];
  for (const code of codes) result.push(await hashRecoveryCode(code));
  return result;
}

async function matchesSavedCode(saved, submitted) {
  if (typeof saved !== "string") return false;
  // Older installations stored ten hexadecimal characters directly. Allow them
  // to be consumed exactly once, but never write them again.
  if (legacyPattern.test(saved)) {
    return legacyPattern.test(submitted) &&
      timingSafeEqual(Buffer.from(saved), Buffer.from(submitted));
  }
  const match = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(saved);
  if (!match || !currentPattern.test(submitted)) return false;
  const actual = Buffer.from(await scrypt(submitted, match[1], 32));
  return timingSafeEqual(actual, Buffer.from(match[2], "hex"));
}

export async function consumeRecoveryCode(saved, input) {
  const submitted = String(input ?? "").trim().toUpperCase();
  const stored = Array.isArray(saved) ? saved : [];
  if (!legacyPattern.test(submitted) && !currentPattern.test(submitted)) {
    return { valid: false, remaining: stored };
  }
  let used = false;
  const remaining = [];
  for (const item of stored) {
    if (!used && await matchesSavedCode(item, submitted)) used = true;
    else remaining.push(item);
  }
  return { valid: used, remaining: used ? remaining : stored };
}

export async function verifyRecoveryCode(saved, input) {
  return (await consumeRecoveryCode(saved, input)).valid;
}
