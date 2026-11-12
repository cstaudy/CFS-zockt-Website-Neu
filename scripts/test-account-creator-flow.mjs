import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
  // Two-account isolation for settings, media metadata and the actual file bytes.
  const second = await request('POST', '/api/account/register', {
    body: { ...registration, email: `creator-other-${randomUUID()}@example.test`, display_name: 'Other Creator' }
  });
  assert.equal(second.status, 201);
  const otherCookie = second.cookie;
  const settingsSaved = await request('PUT', '/api/creator/settings', {
    cookie: login.cookie, body: { settings: { accountMarker: 'creator-A-private' } }
  });
  assert.equal(settingsSaved.status, 200);
  const otherSettings = await request('GET', '/api/creator/settings', { cookie: otherCookie });
  assert.equal(otherSettings.status, 200);
  assert.equal(otherSettings.data.settings?.accountMarker, undefined,
    'Private settings from creator A must not appear in creator B session');

  const upload = async (path, mimeType, filename, bytes) => {
    const response = await fetch(base + path, {
      method: 'POST',
      headers: {
        origin: base, cookie: login.cookie,
        'content-type': mimeType,
        'x-cfs-file-name': encodeURIComponent(filename)
      },
      body: bytes, signal: AbortSignal.timeout(8000)
    });
    return { status: response.status, data: await response.json() };
  };
  const privateImage = Buffer.from('private-image-payload-ci');
  const privateVideo = Buffer.from('private-video-payload-ci');
  const asset = await upload('/api/creator/widget-studio/assets', 'image/png', 'private-ci.png', privateImage);
  assert.equal(asset.status, 201, `Asset upload failed: ${JSON.stringify(asset.data)}`);
  const media = await upload('/api/creator/media/videos', 'video/mp4', 'private-ci.mp4', privateVideo);
  assert.equal(media.status, 201, `Media upload failed: ${JSON.stringify(media.data)}`);

  assert(!(await request('GET', '/api/creator/widget-studio/assets', { cookie: otherCookie }))
    .data.assets?.some(item => item.id === asset.data.asset.id),
    'Second creator cannot see private asset metadata');
  assert(!(await request('GET', '/api/creator/media/videos', { cookie: otherCookie }))
    .data.media?.some(item => item.id === media.data.media.id),
    'Second creator cannot see private media metadata');

  for (const [path, expected] of [
    [asset.data.asset.url, privateImage],
    [media.data.media.url, privateVideo]
  ]) {
    assert(path?.startsWith('/assets/uploads/'), 'Uploaded file must have a private legacy URL');
    for (const [who, cookie, status] of [
      ['anonymous', undefined, 401],
      ['foreign creator', otherCookie, 404],
      ['owner', login.cookie, 200]
    ]) {
      for (const method of ['GET', 'HEAD']) {
        const response = await fetch(base + path, {
          method, headers: cookie ? { cookie } : {}, signal: AbortSignal.timeout(8000)
        });
        assert.equal(response.status, status, `${who} ${method} ${path} must return ${status}`);
        if (status === 200) {
          assert.equal(response.headers.get('cache-control'), 'private, no-store',
            'Private uploads must never be cached as public');
          if (method === 'GET') {
            const actual = Buffer.from(await response.arrayBuffer());
            assert.deepEqual(actual, expected, 'Owner must receive original upload bytes');
          }
        }
      }
    }
  }

  const deleted = await request('DELETE', `/api/creator/media/videos/${media.data.media.id}`, {
    cookie: login.cookie
  });
  assert.equal(deleted.status, 200, 'Owner must be able to delete own media metadata');
  assert.equal((await fetch(base + media.data.media.url, {
    headers: { cookie: login.cookie }
  })).status, 404, 'Deleted media must not be accessible even if bytes remain on disk');

  console.log('PostgreSQL E2E passed: registration, duplicate rejection, password check, login, session, creator CRUD, logout, private upload delivery and account isolation.');
} finally {
  server.kill('SIGTERM');
  await delay(300);
  if (server.exitCode === null) server.kill('SIGKILL');
}
