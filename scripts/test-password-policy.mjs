import assert from 'node:assert/strict';
import { MIN_PASSWORD_LENGTH, isPasswordLongEnough } from '../src/password-policy.js';

assert.equal(MIN_PASSWORD_LENGTH, 15);
assert.equal(isPasswordLongEnough(''), false);
assert.equal(isPasswordLongEnough(undefined), false);
assert.equal(isPasswordLongEnough('a'.repeat(14)), false);
assert.equal(isPasswordLongEnough('a'.repeat(15)), true);
assert.equal(isPasswordLongEnough('a'.repeat(32)), true);
console.log('Password policy: minimum length enforced consistently.');
