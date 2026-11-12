import assert from "node:assert/strict";
import { consumeRecoveryCode, generateRecoveryCodes, hashRecoveryCode, hashRecoveryCodes, verifyRecoveryCode } from "../src/recovery-codes.js";

const plain = generateRecoveryCodes();
assert.equal(plain.length, 8);
assert.equal(new Set(plain).size, 8, "All new recovery codes must be unique");
for (const code of plain) assert.match(code, /^[A-F0-9]{20}$/, "New codes must carry 80 bits");
const stored = await hashRecoveryCodes(plain);
assert.equal(stored.length, plain.length);
assert.equal(new Set(stored).size, stored.length);
for (let i = 0; i < plain.length; i++) {
  assert.match(stored[i], /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
  assert(!stored[i].includes(plain[i]), "Plaintext must never be stored");
  assert.equal(await verifyRecoveryCode(stored, plain[i]), true);
}
assert.notEqual(await hashRecoveryCode(plain[0]), stored[0], "Hashes must have independent salts");

const first = await consumeRecoveryCode(stored, plain[0].toLowerCase());
assert.equal(first.valid, true);
assert.equal(first.remaining.length, 7);
assert.equal(await verifyRecoveryCode(first.remaining, plain[0]), false, "Consumed codes must not replay");
assert.equal(await verifyRecoveryCode(first.remaining, plain[1]), true);
assert.equal(await verifyRecoveryCode(stored, "INVALID"), false);
assert.equal(await verifyRecoveryCode(stored, "A".repeat(80)), false);

const legacy = ["ABCDEF1234", "ABCDEF5678"];
assert.equal(await verifyRecoveryCode(legacy, "abcdef1234"), true, "Old ten-character codes remain valid");
const used = await consumeRecoveryCode(legacy, "abcdef1234");
assert.equal(used.valid, true);
assert.deepEqual(used.remaining, ["ABCDEF5678"]);
assert.equal(await verifyRecoveryCode(used.remaining, "ABCDEF1234"), false);
assert.equal(await verifyRecoveryCode(legacy, "ABCDEF123"), false);
assert.equal(await verifyRecoveryCode(legacy, plain[0]), false);

const corrupted = ["scrypt$broken$format", "ABCDEF1234"];
assert.equal((await consumeRecoveryCode(corrupted, "ABCDEF1234")).valid, true, "Malformed hashes cannot hide other valid entries");
assert.equal(await verifyRecoveryCode(["scrypt$broken$format"], plain[0]), false);
console.log("Recovery codes: unique 80-bit codes, salted hashes, one-time use and legacy compatibility passed.");
