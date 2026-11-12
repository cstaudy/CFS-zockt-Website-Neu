import { createHash, randomBytes } from "node:crypto";

// Lightweight per-process guard, intentionally independent of the account DB.
// Multi-instance deployments additionally require a shared backing store.
const salt = randomBytes(24);
const windowMs = 15 * 60 * 1000;
const accountLimit = 8;
const addressLimit = 80;
const capacity = 20000;

const digest = value => createHash("sha256").update(salt).update(String(value)).digest("hex");

export function createLoginThrottle() {
  const attempts = new Map();
  function pruneExpired(now) {
  for (const [key, bucket] of attempts) {
    if (bucket.expiresAt <= now) attempts.delete(key);
  }
}

function reserve(key, max, now) {
  let bucket = attempts.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    if (!bucket && attempts.size >= capacity) {
      pruneExpired(now);
      if (attempts.size >= capacity) return { allowed: false, retryAfter: 60 };
    }
    bucket = { count: 0, expiresAt: now + windowMs };
    attempts.set(key, bucket);
  }
  if (bucket.count >= max) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)) };
  }
  // Reserve before awaiting password verification so parallel requests cannot
  // all bypass the limit in a single request burst.
  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}

  return {
    allow(address, email, now = Date.now()) {
      const source = String(address || "unknown").slice(0, 128);
      const identity = String(email || "").trim().toLowerCase().slice(0, 320);
      const sourceKey = `ip:${digest(source)}`;
      const accountKey = `pair:${digest(source + "\0" + identity)}`;
      const ip = reserve(sourceKey, addressLimit, now);
      if (!ip.allowed) return ip;
      return reserve(accountKey, accountLimit, now);
    },
    successful(address, email) {
      const source = String(address || "unknown").slice(0, 128);
      const identity = String(email || "").trim().toLowerCase().slice(0, 320);
      attempts.delete(`pair:${digest(source + "\0" + identity)}`);
    }
  };
}

export const loginThrottle = createLoginThrottle();
