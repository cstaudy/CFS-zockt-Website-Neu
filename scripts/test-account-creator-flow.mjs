import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { totpCode } from '../src/totp.js';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

// Never run destructive acceptance tests on a production or staging DB.
const databaseUrl = process.env.DATABASE_URL || '';
let dbHost = '';
try { dbHost = new URL(databaseUrl).hostname; } catch {}
if (process.env.CFS_CI_DATABASE_ACCEPTANCE !== 'yes' ||
    !['127.0.0.1', 'localhost', '::1'].includes(dbHost)) {
  throw new Error('Acceptance test blocked: requires explicit CI opt-in and a local disposable PostgreSQL database.');
}
const root = fileURLToPath(new URL('../', import.meta.url));
const port = await new Promise((resolve, reject) => {
  const listener = createServer();
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', () => {
    const selected = listener.address().port;
    listener.close(() => resolve(selected));
  });
});
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/start.js'], {
  cwd: root,
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MIGRATION_BASELINE_ON_START: 'no'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
for (const pipe of [server.stdout, server.stderr]) {
  pipe.on('data', chunk => { output = (output + chunk.toString()).slice(-6000); });
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(method, path, { body, cookie } = {}) {
  const headers = { origin: base };
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(base + path, {
    method, headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(8000)
  });
  const data = await response.json();
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`Server exited during startup: ${output}`);
    try {
      const response = await request('GET', '/api/ready');
      if (response.status === 200 && response.data?.ok === true) { ready = true; break; }
    } catch { /* server not ready yet */ }
    await delay(125);
  }
  assert(ready, `Server did not become database-ready: ${output}`);

  const email = `creator-ci-${randomUUID()}@example.test`;
  const password = 'ci-passphrase-is-very-long';
  const registration = {
    email, password, display_name: 'CI Creator',
    terms_accepted: true, privacy_acknowledged: true,
    beta_acknowledged: true, age_18_confirmed: true
  };

  assert.equal((await request('GET', '/api/account/me')).data.authenticated, false, 'Anonymous visitor must not have a session');
  assert.equal((await request('GET', '/api/creator/projects')).status, 401, 'Creator data must be private');
  assert.equal((await request('POST', '/api/account/register', { body: { ...registration, password: 'too-short' } })).status, 400,
    'Registration must enforce a sufficiently long password');

  const created = await request('POST', '/api/account/register', { body: registration });
  assert.equal(created.status, 201, `Registration failed: ${JSON.stringify(created.data)}`);
  assert.equal(created.data.account?.email, email);
  assert(created.cookie.startsWith('cfs_session='), 'Registration must create a session cookie');
  assert.equal((await request('POST', '/api/account/register', { body: registration })).status, 409,
    'A duplicate registered email must not create another account');
  assert.equal((await request('POST', '/api/account/login', { body: { email, password: 'wrong-password' } })).status, 401,
    'Incorrect credentials must not log in');

  const authenticated = await request('GET', '/api/account/me', { cookie: created.cookie });
  assert.equal(authenticated.status, 200);
  assert.equal(authenticated.data.authenticated, true, 'Session must authenticate subsequent requests');
  assert.equal(authenticated.data.account?.email, email);
  assert.equal((await request('GET', '/api/admin/status', { cookie: created.cookie })).status, 403,
    'Normal creators must not receive admin access');

  const saved = await request('POST', '/api/creator/projects', {
    cookie: created.cookie,
    body: { kind: 'widget', name: 'CI Widget', data: { headline: 'Saved creator content' } }
  });
  assert.equal(saved.status, 201, `Creator save failed: ${JSON.stringify(saved.data)}`);
  const projectId = saved.data.project?.id;
  assert(projectId, 'Saved project must have an ID');

  const listed = await request('GET', '/api/creator/projects', { cookie: created.cookie });
  assert.equal(listed.status, 200);
  assert(listed.data.projects?.some(p => p.id === projectId && p.data?.headline === 'Saved creator content'),
    'Creator data must be persisted and readable');

  const edited = await request('PATCH', `/api/creator/projects/${encodeURIComponent(projectId)}`, {
    cookie: created.cookie,
    body: { name: 'Updated CI Widget', data: { headline: 'Updated content' } }
  });
  assert.equal(edited.status, 200, `Creator update failed: ${JSON.stringify(edited.data)}`);
  assert.equal(edited.data.project?.name, 'Updated CI Widget');

  const archived = await request('DELETE', `/api/creator/projects/${encodeURIComponent(projectId)}`, { cookie: created.cookie });
  assert.equal(archived.status, 200, 'Owner must be able to archive their project');
  const afterArchive = await request('GET', '/api/creator/projects', { cookie: created.cookie });
  assert(!afterArchive.data.projects?.some(p => p.id === projectId), 'Archived projects must be removed from active lists');

  const logout = await request('POST', '/api/account/logout', { cookie: created.cookie });
  assert.equal(logout.status, 200);
  assert.equal((await request('GET', '/api/account/me', { cookie: created.cookie })).data.authenticated, false,
    'Logout must invalidate the old session');

  const login = await request('POST', '/api/account/login', { body: { email, password } });
  assert.equal(login.status, 200, 'Creator must be able to sign back in');
  assert(login.cookie.startsWith('cfs_session='), 'Login must issue a session cookie');
  assert.equal((await request('GET', '/api/account/me', { cookie: login.cookie })).data.authenticated, true);
  // Activated MFA must prevent the password step from creating any usable
  // application session. Test against the isolated disposable PostgreSQL instance.
  const testPool = new pg.Pool({ connectionString: databaseUrl, ssl: false });
  try {
    const setup = await request('POST', '/api/account/mfa/setup', {
      cookie: login.cookie, body: { password }
    });
    assert.equal(setup.status, 200, `MFA setup failed: ${JSON.stringify(setup.data)}`);
    const testSecret = setup.data.secret;
    assert(testSecret, 'Authenticator setup must create a secret');
    const enabled = await request('POST', '/api/account/mfa/enable', {
      cookie: login.cookie, body: { code: totpCode(testSecret) }
    });
    assert.equal(enabled.status, 200, `MFA enable failed: ${JSON.stringify(enabled.data)}`);
    const duplicateEnable = await request('POST', '/api/account/mfa/enable', {
      cookie: login.cookie, body: { code: totpCode(testSecret) }
    });
    assert.equal(duplicateEnable.status, 409, 'MFA must never be enabled twice with overwritten recovery codes');
    const failedRotation = await request('POST', '/api/account/mfa/recovery-codes', {
      cookie: login.cookie, body: { code: 'incorrect' }
    });
    assert.equal(failedRotation.status, 400, 'Invalid authenticator cannot rotate recovery codes');

    const recoveryCode = enabled.data.recovery_codes?.[0];
    assert(recoveryCode, 'MFA setup must issue recovery codes');
    assert.match(recoveryCode, /^[A-F0-9]{20}$/, 'New recovery codes must contain 80 bits');
    const initialStored = (await testPool.query(
      "select recovery_codes from account_mfa where account_id=$1", [created.data.account.id]
    )).rows[0].recovery_codes;
    assert(initialStored.every(value => /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(value)),
      'Database must store only salted recovery-code hashes');
    assert(!initialStored.includes(recoveryCode), 'No raw recovery codes may appear in PostgreSQL');
    assert.equal((await request('GET', '/api/account/me', { cookie: created.cookie })).data.authenticated, false,
      'Enabling MFA must revoke older sessions');
    assert.equal((await request('GET', '/api/account/me', { cookie: login.cookie })).data.authenticated, true,
      'The current setup session remains available to save recovery codes');

    const pending = await request('POST', '/api/account/login', { body: { email, password } });
    assert.equal(pending.status, 200);
    assert.equal(pending.data.mfa_required, true, 'An MFA-enabled account requires a second factor');
    assert.equal(pending.data.authenticated, false);
    assert(pending.cookie.startsWith('cfs_mfa_pending='), 'Pending challenge cookie is required');
    assert(!pending.cookie.includes('cfs_session='), 'Password may not create a full session');
    assert.equal((await request('GET', '/api/account/me', { cookie: pending.cookie })).data.authenticated, false);
    assert.equal((await request('GET', '/api/creator/projects', { cookie: pending.cookie })).status, 401);

    const wrong = await request('POST', '/api/account/mfa/login', {
      cookie: pending.cookie, body: { code: 'abcdef' }
    });
    assert.equal(wrong.status, 401, 'Invalid MFA code must be rejected');
    assert.equal((await request('GET', '/api/creator/projects', { cookie: pending.cookie })).status, 401);
    const code = totpCode(testSecret);
    const success = await request('POST', '/api/account/mfa/login', {
      cookie: pending.cookie, body: { code }
    });
    assert.equal(success.status, 200, `Valid TOTP login failed: ${JSON.stringify(success.data)}`);
    assert(success.cookie.startsWith('cfs_session='), 'Full session only after valid MFA');
    assert.equal((await request('GET', '/api/account/me', { cookie: success.cookie })).data.authenticated, true);
    assert.equal((await request('POST', '/api/account/mfa/login', {
      cookie: pending.cookie, body: { code }
    })).status, 401, 'Consumed challenge cannot be replayed');

    const recoveryPending = await request('POST', '/api/account/login', { body: { email, password } });
    assert.equal(recoveryPending.data.mfa_required, true);
    const recovery = await request('POST', '/api/account/mfa/login', {
      cookie: recoveryPending.cookie, body: { recovery_code: recoveryCode }
    });
    assert.equal(recovery.status, 200);
    assert.equal(recovery.data.recovery_code_used, true);
    const remainingCodes = (await testPool.query(
      "select recovery_codes from account_mfa where account_id=$1", [created.data.account.id]
    )).rows[0].recovery_codes;
    assert(!remainingCodes.includes(recoveryCode), 'Recovery code must be consumed atomically');

    const replayPending = await request('POST', '/api/account/login', { body: { email, password } });
    assert.equal((await request('POST', '/api/account/mfa/login', {
      cookie: replayPending.cookie, body: { recovery_code: recoveryCode }
    })).status, 401, 'A used recovery code must never work again');
    for (let i = 0; i < 4; i++) {
      assert.equal((await request('POST', '/api/account/mfa/login', {
        cookie: replayPending.cookie, body: { code: 'invalid' }
      })).status, 401);
    }
    assert.equal((await request('POST', '/api/account/mfa/login', {
      cookie: replayPending.cookie, body: { code: totpCode(testSecret) }
    })).status, 401, 'Five failed attempts must invalidate the challenge');
    // Two concurrent MFA-disable requests may never both succeed. The winner
    // must also revoke all full sessions and pending login challenges.
    const previousCodes = enabled.data.recovery_codes;
    const rotationAttempts = await Promise.all([
      request('POST', '/api/account/mfa/recovery-codes', {
        cookie: success.cookie, body: { code: totpCode(testSecret) }
      }),
      request('POST', '/api/account/mfa/recovery-codes', {
        cookie: success.cookie, body: { code: totpCode(testSecret) }
      })
    ]);
    assert.deepEqual(rotationAttempts.map(result => result.status).sort((a,b) => a-b), [200, 429],
      'Concurrent valid MFA recovery rotations must produce exactly one new code set');
    const rotated = rotationAttempts.find(result => result.status === 200);
    const repeatedRotation = await request('POST', '/api/account/mfa/recovery-codes', {
      cookie: success.cookie, body: { code: totpCode(testSecret) }
    });
    assert.equal(repeatedRotation.status, 429, 'Recovery rotation cooldown must persist across new HTTP requests');
    const freshCodes = rotated.data.recovery_codes;
    assert.equal(freshCodes?.length, 8);
    const persistedRotation = (await testPool.query(
      "select recovery_codes, recovery_rotated_at from account_mfa where account_id=$1",
      [created.data.account.id]
    )).rows[0];
    assert(persistedRotation.recovery_rotated_at, 'Rotation timestamp must be stored in PostgreSQL');
    const afterRotation = persistedRotation.recovery_codes;
    assert(afterRotation.every(value => /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(value)),
      'Rotation must persist only hashes');
    assert(!afterRotation.includes(freshCodes[1]), 'Rotation must not persist plaintext');
    const obsoletePending = await request('POST', '/api/account/login', { body: { email, password } });
    assert.equal((await request('POST', '/api/account/mfa/login', {
      cookie: obsoletePending.cookie, body: { recovery_code: previousCodes[1] }
    })).status, 401, 'Rotating codes must invalidate previous recovery codes');
    const disableCode = freshCodes[1];
    const disableAttempts = await Promise.all([
      request('POST', '/api/account/mfa/disable', { cookie: success.cookie, body: { recovery_code: disableCode } }),
      request('POST', '/api/account/mfa/disable', { cookie: success.cookie, body: { recovery_code: disableCode } })
    ]);
    assert.deepEqual(disableAttempts.map(result => result.status).sort((a,b) => a-b)[0], 200,
      'Exactly one concurrent MFA-disable request must succeed');
    assert([401, 409].includes(disableAttempts.map(result => result.status).sort((a,b) => a-b)[1]),
      'Concurrent attempt must be rejected after the first disables MFA');
    const stateAfterDisable = (await testPool.query(
      "select enabled,recovery_codes from account_mfa where account_id=$1", [created.data.account.id]
    )).rows[0];
    assert.equal(stateAfterDisable.enabled, false);
    assert.deepEqual(stateAfterDisable.recovery_codes, [], 'Disable must remove all recovery-code hashes');
    assert.equal((await request('GET', '/api/account/me', { cookie: success.cookie })).data.authenticated, false,
      'Disabling MFA must revoke the previously authenticated session');
    assert.equal((await request('POST', '/api/account/mfa/login', {
      cookie: replayPending.cookie, body: { code: totpCode(testSecret) }
    })).status, 401, 'Disabling MFA must cancel pending login challenges');
    assert.equal((await testPool.query(
      "select count(*)::int as count from mfa_login_challenges where account_id=$1",
      [created.data.account.id]
    )).rows[0].count, 0);
    const disabledAccountLogin = await request('POST', '/api/account/login', { body: { email, password } });
    assert.equal(disabledAccountLogin.status, 200, 'After explicit MFA-disable, normal login must be possible');
    assert.equal(disabledAccountLogin.data.authenticated, true);
    assert(disabledAccountLogin.cookie.startsWith('cfs_session='));

  } finally {
    await testPool.end();
  }
  console.log('PostgreSQL E2E passed: registration, creator CRUD, and MFA challenge / TOTP / recovery / replay protection.');
} finally {
  server.kill('SIGTERM');
  await delay(300);
  if (server.exitCode === null) server.kill('SIGKILL');
}
