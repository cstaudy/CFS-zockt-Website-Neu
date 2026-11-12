import assert from "node:assert/strict";
import { createLoginThrottle } from "../src/login-throttle.js";

const limiter = createLoginThrottle();
const time = 100_000;
for (let i = 0; i < 8; i++) {
  assert.equal(limiter.allow("127.0.0.1", "CREATOR@EXAMPLE.TEST", time).allowed, true);
}
const blocked = limiter.allow("127.0.0.1", "creator@example.test", time);
assert.equal(blocked.allowed, false, "Aliases and capitalization must share a quota");
assert.equal(blocked.retryAfter, 900);
assert.equal(limiter.allow("127.0.0.1", "another@example.test", time).allowed, true,
  "Separate account identities may still log in");
assert.equal(limiter.allow("10.0.0.2", "creator@example.test", time).allowed, true,
  "Separate source addresses must have independent quotas");
limiter.successful("127.0.0.1", "creator@example.test");
assert.equal(limiter.allow("127.0.0.1", "creator@example.test", time).allowed, true,
  "A successful login resets only its account/source quota");
const elapsed = limiter.allow("127.0.0.1", "creator@example.test", time + 901_000);
assert.equal(elapsed.allowed, true, "Expired account quotas must reset");

const ipLimiter = createLoginThrottle();
for (let n = 0; n < 80; n++) {
  assert.equal(ipLimiter.allow("198.51.100.4", `user-${n}@example.test`, time).allowed, true);
}
const ipBlocked = ipLimiter.allow("198.51.100.4", "new@example.test", time);
assert.equal(ipBlocked.allowed, false, "Changing email must not bypass source-wide cap");
assert.equal(ipLimiter.allow("198.51.100.5", "new@example.test", time).allowed, true);
assert.equal(ipLimiter.allow("198.51.100.4", "new@example.test", time + 900_000).allowed, true,
  "Source quotas reset after the window");

const burst = createLoginThrottle();
assert.deepEqual(Array.from({ length: 10 }, () =>
  burst.allow("203.0.113.10", "victim@example.test", time).allowed),
[true, true, true, true, true, true, true, true, false, false],
"Reservations must be counted before async password verification");
console.log("Login throttle: account limits, source-wide limits, normalized identity, reset and concurrent reservations passed.");
