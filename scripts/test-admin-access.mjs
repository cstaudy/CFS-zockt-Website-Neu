import assert from 'node:assert/strict';
import { ADMIN_EMAIL, isAdminEmail, isAdminAccount } from '../src/admin-access.js';

assert.equal(isAdminEmail(ADMIN_EMAIL.toUpperCase()), true);
assert.equal(isAdminAccount(null), false);
assert.equal(isAdminAccount({ email: ADMIN_EMAIL }), false, 'email alone cannot grant admin');
assert.equal(isAdminAccount({ email: ADMIN_EMAIL, role: 'creator', email_verified_at: new Date() }), false, 'role must be explicit');
assert.equal(isAdminAccount({ email: ADMIN_EMAIL, role: 'admin', email_verified_at: null }), false, 'unverified inbox denied');
assert.equal(isAdminAccount({ email: 'another@example.test', role: 'admin', email_verified_at: new Date() }), false, 'wrong email denied');
assert.equal(isAdminAccount({ email: 'CSTAUDYGAMING@GOOGLEMAIL.COM', role: 'admin', email_verified_at: new Date() }), true, 'verified role is accepted');
console.log('Admin access: email, database role and verification are all required.');
