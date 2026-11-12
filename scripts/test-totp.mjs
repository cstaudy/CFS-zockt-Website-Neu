import assert from 'node:assert/strict';
import { totpCode, verifyTotp, decodeTotpSecret } from '../src/totp.js';

// RFC 6238 SHA-1 test vector (8-digit 94287082 => 6-digit 287082).
const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
assert.equal(totpCode(secret, 59), '287082');
assert.equal(verifyTotp(secret, '287082', 59), true);
assert.equal(verifyTotp(secret, '287082', 29), true, 'one early step allowed');
assert.equal(verifyTotp(secret, '287082', 89), true, 'one late step allowed');
assert.equal(verifyTotp(secret, '287082', 119), false, 'two late steps denied');
assert.equal(verifyTotp(secret, '287082', 0), false, 'far out of window denied');
assert.equal(verifyTotp(secret, '287082 ', 59), false, 'whitespace denied');
assert.equal(verifyTotp(secret, 287082, 59), true, 'numeric code accepted only if six digits');
assert.equal(verifyTotp(secret, '0287082', 59), false, 'seven digits denied');
assert.equal(verifyTotp(secret, 'abcdef', 59), false, 'non-digits denied');
assert.equal(verifyTotp(secret, '', 59), false);
assert.equal(verifyTotp(secret, '287082', -1), false);
assert.equal(verifyTotp(secret, '287082', NaN), false);
assert.equal(verifyTotp('INVALID!BASE32', '287082', 59), false);
assert.equal(decodeTotpSecret('INVALID!BASE32'), null);
assert.equal(decodeTotpSecret('A'), null);
assert.equal(totpCode('INVALID', 59), null);
assert.equal(verifyTotp(secret, '287082', 59.5), false);
console.log('TOTP RFC6238 vector, +/-1 clock step, strict input and invalid-secret checks passed.');
