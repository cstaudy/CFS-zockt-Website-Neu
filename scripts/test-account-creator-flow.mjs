import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const ciLauncherSecret = 'ci-bridge-local-only-secret-for-sync-tests';
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
    MIGRATION_BASELINE_ON_START: 'no',
    CFS_LOGIN_THROTTLE_SOCKET_MODE: 'enabled',
    LAUNCHER_BRIDGE_SECRET: ciLauncherSecret
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
for (const pipe of [server.stdout, server.stderr]) {
  pipe.on('data', chunk => { output = (output + chunk.toString()).slice(-6000); });
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(method, path, { body, cookie, extraHeaders } = {}) {
  const headers = { origin: base, ...(extraHeaders || {}) };
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

  // Every creator endpoint must enforce ownership, not just authentication.
  const secondEmail = `creator-other-${randomUUID()}@example.test`;
  const second = await request('POST', '/api/account/register', {
    body: { ...registration, email: secondEmail, display_name: 'Second Creator' }
  });
  assert.equal(second.status, 201, 'Second creator registration must succeed');
  const otherCookie = second.cookie;
  const foreignList = await request('GET', '/api/creator/projects', { cookie: otherCookie });
  assert.equal(foreignList.status, 200);
  assert(!foreignList.data.projects?.some(p => p.id === projectId),
    'Creator B must never see creator A projects');

  for (const [verb, path, body] of [
    ['PATCH', `/api/creator/projects/${encodeURIComponent(projectId)}`, { name: 'Hijacked widget' }],
    ['DELETE', `/api/creator/projects/${encodeURIComponent(projectId)}`, undefined]
  ]) {
    const denied = await request(verb, path, { cookie: otherCookie, body });
    assert.equal(denied.status, 404,
      'Cross-account project modifications must not reveal or modify another creator data');
  }
  const stillOwned = await request('GET', '/api/creator/projects', { cookie: created.cookie });
  assert(stillOwned.data.projects?.some(p => p.id === projectId && p.name === 'Updated CI Widget'),
    'Foreign modification attempts must not change the owner project');

  const sceneCreated = await request('POST', '/api/creator/widget-studio/scenes', {
    cookie: created.cookie, body: { name: 'Owner Scene', config: { marker: 'private scene' } }
  });
  assert.equal(sceneCreated.status, 201, `Scene creation failed: ${JSON.stringify(sceneCreated.data)}`);
  const sceneId = sceneCreated.data.scene?.id;
  assert(sceneId);
  assert(!(await request('GET', '/api/creator/widget-studio/scenes', {
    cookie: otherCookie
  })).data.scenes?.some(scene => scene.id === sceneId),
    'Second creator must not see owner scenes');
  assert.equal((await request('PUT', `/api/creator/widget-studio/scenes/${sceneId}`, {
    cookie: otherCookie, body: { name: 'Stolen Scene' }
  })).status, 404, 'Second creator must not edit foreign scenes');
  assert.equal((await request('POST', `/api/creator/widget-studio/scenes/${sceneId}/publish`, {
    cookie: otherCookie, body: {}
  })).status, 404, 'Second creator must not publish foreign scenes');

  const widgetCreated = await request('POST', '/api/creator/widget-studio/widgets', {
    cookie: created.cookie, body: { name: 'Owner Widget', widget_type: 'manual_counter' }
  });
  assert.equal(widgetCreated.status, 201, `Widget creation failed: ${JSON.stringify(widgetCreated.data)}`);
  const widgetId = widgetCreated.data.widget?.id;
  assert(widgetId);
  assert(!(await request('GET', '/api/creator/widget-studio/widgets', {
    cookie: otherCookie
  })).data.widgets?.some(widget => widget.id === widgetId),
    'Creator B must not see creator A widgets');
  for (const [verb, suffix] of [['GET', ''], ['PUT', '/draft'], ['POST', '/publish']]) {
    const denied = await request(verb, `/api/creator/widget-studio/widgets/${widgetId}${suffix}`, {
      cookie: otherCookie, body: verb === 'GET' ? undefined : { name: 'Stolen Widget' }
    });
    assert.equal(denied.status, 404, 'Foreign widget access must return not found');
  }
  assert.equal((await request('GET', `/api/creator/widget-studio/widgets/${widgetId}`, {
    cookie: created.cookie
  })).status, 200, 'Owner must still access their own widget');

  // A published OBS/widget snapshot is immutable until explicitly republished.
  assert.equal((await request('PUT', `/api/creator/widget-studio/widgets/not-a-uuid/draft`, {
    cookie: created.cookie, body: {}
  })).status, 404, 'Malformed widget IDs must fail closed');
  assert.equal((await request('PUT', `/api/creator/widget-studio/widgets/${widgetId}/draft`, {
    cookie: created.cookie, body: null
  })).status, 400, 'Null widget edits must not crash the server');
  assert.equal((await request('PUT', `/api/creator/widget-studio/widgets/${widgetId}/draft`, {
    cookie: created.cookie, body: { config: { elements: [{ type: 'text', rotation: 361 }] } }
  })).status, 400, 'Invalid element geometry must be rejected before database write');
  const widgetPublishedConfig = {
    widgetType: 'manual_counter', canvas: { width: 620, height: 132 },
    elements: [{ id: 'published_text', type: 'text', data: { text: 'VISIBLE VERSION' },
      style: { fontSize: 24, color: '#ffffff' } }],
    settings: { manualValue: 7 }
  };
  const widgetDraftSave = await request('PUT', `/api/creator/widget-studio/widgets/${widgetId}/draft`, {
    cookie: created.cookie, body: { expected_version: 1, config: widgetPublishedConfig }
  });
  assert.equal(widgetDraftSave.status, 200, 'Owner widget draft save must succeed');
  assert.equal(widgetDraftSave.data.widget.version, 2);
  assert.equal(widgetDraftSave.data.widget.published_config, null,
    'Draft cannot be publicly available before explicit publish');
  const firstWidgetPublish = await request('POST', `/api/creator/widget-studio/widgets/${widgetId}/publish`, {
    cookie: created.cookie, body: { expected_version: 2 }
  });
  assert.equal(firstWidgetPublish.status, 200, 'Owner widget publish must succeed');
  assert.equal(firstWidgetPublish.data.widget.status, 'live');
  assert.equal(firstWidgetPublish.data.widget.published_config.elements[0].data.text, 'VISIBLE VERSION');
  assert.equal(firstWidgetPublish.data.widget.has_unpublished_changes, false);
  const privateDraftConfig = {
    ...widgetPublishedConfig,
    elements: [{ id: 'private_text', type: 'text', data: { text: 'PRIVATE DRAFT' } }]
  };
  const widgetPrivateEdit = await request('PUT', `/api/creator/widget-studio/widgets/${widgetId}/draft`, {
    cookie: created.cookie, body: { expected_version: 3, config: privateDraftConfig }
  });
  assert.equal(widgetPrivateEdit.status, 200, 'Edit after publish must stay private');
  assert.equal(widgetPrivateEdit.data.widget.version, 4);
  assert.equal(widgetPrivateEdit.data.widget.status, 'live',
    'Published version must remain live while its next draft is edited');
  assert.equal(widgetPrivateEdit.data.widget.draft_config.elements[0].data.text, 'PRIVATE DRAFT');
  assert.equal(widgetPrivateEdit.data.widget.published_config.elements[0].data.text, 'VISIBLE VERSION',
    'Draft content must not alter previously published snapshot');
  assert.equal(widgetPrivateEdit.data.widget.has_unpublished_changes, true);
  const widgetAfterSave = await request('GET', `/api/creator/widget-studio/widgets/${widgetId}`, {
    cookie: created.cookie
  });
  assert.equal(widgetAfterSave.data.widget.published_config.elements[0].data.text, 'VISIBLE VERSION');
  assert.equal((await request('PUT', `/api/creator/widget-studio/widgets/${widgetId}/draft`, {
    cookie: created.cookie, body: { expected_version: 3, name: 'Stale overwrite' }
  })).status, 409, 'Old edit revision must not overwrite a newer draft');
  const races = await Promise.all(['Race A', 'Race B'].map(name =>
    request('PUT', `/api/creator/widget-studio/widgets/${widgetId}/draft`, {
      cookie: created.cookie, body: { expected_version: 4, name }
    })
  ));
  assert.deepEqual(races.map(result => result.status).sort((a, b) => a - b), [200, 409],
    'Concurrent widget updates must serialize by row version');
  const widgetAfterRace = await request('GET', `/api/creator/widget-studio/widgets/${widgetId}`, {
    cookie: created.cookie
  });
  assert.equal(widgetAfterRace.data.widget.published_config.elements[0].data.text, 'VISIBLE VERSION',
    'Concurrent draft updates cannot alter public snapshot');
  const widgetRepublish = await request('POST', `/api/creator/widget-studio/widgets/${widgetId}/publish`, {
    cookie: created.cookie, body: { expected_version: widgetAfterRace.data.widget.version }
  });
  assert.equal(widgetRepublish.status, 200);
  assert.equal(widgetRepublish.data.widget.published_config.elements[0].data.text, 'PRIVATE DRAFT',
    'Only explicit publish changes public widget snapshot');
  assert.equal(widgetRepublish.data.widget.has_unpublished_changes, false);

  const secondProject = await request('POST', '/api/creator/projects', {
    cookie: otherCookie, body: { kind: 'design', name: 'Private B Design', data: { secret: 'B only' } }
  });
  assert.equal(secondProject.status, 201);
  assert(!(await request('GET', '/api/creator/projects', { cookie: created.cookie }))
    .data.projects?.some(project => project.id === secondProject.data.project.id),
    'Creator A must also be unable to see creator B private data');

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
  const mediaSecond = await request('POST', '/api/account/register', {
    body: { ...registration, email: `creator-other-${randomUUID()}@example.test`, display_name: 'Other Creator' }
  });
  assert.equal(mediaSecond.status, 201);
  const mediaOtherCookie = mediaSecond.cookie;
  const settingsSaved = await request('PUT', '/api/creator/settings', {
    cookie: login.cookie, body: { settings: { accountMarker: 'creator-A-private' } }
  });
  assert.equal(settingsSaved.status, 200);
  const otherSettings = await request('GET', '/api/creator/settings', { cookie: mediaOtherCookie });
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

  assert(!(await request('GET', '/api/creator/widget-studio/assets', { cookie: mediaOtherCookie }))
    .data.assets?.some(item => item.id === asset.data.asset.id),
    'Second creator cannot see private asset metadata');
  assert(!(await request('GET', '/api/creator/media/videos', { cookie: mediaOtherCookie }))
    .data.media?.some(item => item.id === media.data.media.id),
    'Second creator cannot see private media metadata');

  for (const [path, expected] of [
    [asset.data.asset.url, privateImage],
    [media.data.media.url, privateVideo]
  ]) {
    assert(path?.startsWith('/assets/uploads/'), 'Uploaded file must have a private legacy URL');
    for (const [who, cookie, status] of [
      ['anonymous', undefined, 401],
      ['foreign creator', mediaOtherCookie, 404],
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

  // A public project's image reference allows OBS to fetch JUST that image.
  // A different creator cannot publish someone else's asset by referencing its URL.
  const attackerProject = await request('POST', '/api/creator/projects', {
    cookie: mediaOtherCookie,
    body: { kind: 'widget', name: 'Foreign URL reference', data: { image: asset.data.asset.url } }
  });
  assert.equal(attackerProject.status, 201);
  assert.equal((await request('PATCH', `/api/creator/projects/${attackerProject.data.project.id}`, {
    cookie: mediaOtherCookie, body: { status: 'published' }
  })).status, 200);
  assert.equal((await fetch(base + asset.data.asset.url)).status, 401,
    'A published reference from a foreign creator must not expose the private image');

  const ownerProject = await request('POST', '/api/creator/projects', {
    cookie: login.cookie,
    body: {
      kind: 'widget',
      name: 'Owner OBS overlay',
      data: { config: { elements: [{ type: 'image', data: { src: asset.data.asset.url } }] } }
    }
  });
  assert.equal(ownerProject.status, 201);
  assert.equal((await fetch(base + asset.data.asset.url)).status, 401,
    'A draft image reference must not grant public access');
  assert.equal((await request('PATCH', `/api/creator/projects/${ownerProject.data.project.id}`, {
    cookie: login.cookie, body: { status: 'published' }
  })).status, 200);
  for (const method of ['GET', 'HEAD']) {
    const response = await fetch(base + asset.data.asset.url, { method });
    assert.equal(response.status, 200, 'Published OBS image must be accessible without a login');
    assert.equal(response.headers.get('cache-control'), 'private, no-store',
      'Uploads should not persist in public caches after unpublish');
    if (method === 'GET') assert.deepEqual(Buffer.from(await response.arrayBuffer()), privateImage);
  }
  assert.equal((await fetch(base + media.data.media.url)).status, 401,
    'Public overlay reference must not expose private videos');
  assert.equal((await request('PATCH', `/api/creator/projects/${ownerProject.data.project.id}`, {
    cookie: login.cookie, body: { status: 'private' }
  })).status, 200);
  assert.equal((await fetch(base + asset.data.asset.url)).status, 401,
    'Unpublishing the owner widget must immediately revoke anonymous access');
  const deleted = await request('DELETE', `/api/creator/media/videos/${media.data.media.id}`, {
    cookie: login.cookie
  });
  assert.equal(deleted.status, 200, 'Owner must be able to delete own media metadata');
  assert.equal((await fetch(base + media.data.media.url, {
    headers: { cookie: login.cookie }
  })).status, 404, 'Deleted media must not be accessible even if bytes remain on disk');

  // The HTTP guard shares its counters across both public login aliases.
  // This check runs last because a locked account must remain locked.
  for (let i = 0; i < 8; i++) {
    const endpoint = i % 2 === 0 ? '/api/account/login' : '/api/auth/login';
    const failed = await request('POST', endpoint, { body: { email: mediaSecond.data.account.email, password: 'definitely-wrong-password' } });
    assert.equal(failed.status, 401, 'Failures below quota must return normal invalid-credential response');
  }
  const rateLimited = await request('POST', '/api/account/login', { body: { email: mediaSecond.data.account.email, password } });
  assert.equal(rateLimited.status, 429, 'A correct password must not bypass an active login quota');
  assert.equal(rateLimited.data.error, 'LOGIN_RATE_LIMITED');
  assert.equal((await request('GET', '/api/account/me', { cookie: login.cookie })).data.authenticated, true,
    'Rate-limited login must never invalidate an existing authenticated session');

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
    const replayStep = await request('POST', '/api/account/login', { body: { email, password } });
    assert.equal(replayStep.data.mfa_required, true);
    assert.equal((await request('POST', '/api/account/mfa/login', {
      cookie: replayStep.cookie, body: { code }
    })).status, 401, 'Consumed TOTP must not work in a new challenge while still in its time window');
    assert.equal((await request('GET', '/api/creator/projects', { cookie: replayStep.cookie })).status, 401);
    const afterReplay = (await testPool.query(
      "select last_login_totp_step from account_mfa where account_id=$1", [created.data.account.id]
    )).rows[0];
    assert(afterReplay.last_login_totp_step !== null, 'Accepted TOTP step must persist in PostgreSQL');
    const differentRecovery = await request('POST', '/api/account/mfa/login', {
      cookie: replayStep.cookie, body: { recovery_code: enabled.data.recovery_codes[2] }
    });
    assert.equal(differentRecovery.status, 200, 'Recovery-code fallback must still work after a rejected repeated TOTP');


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
    // A new password submission must not reset pending-code attempts or
    // mint unlimited fresh challenges. The account-wide quota is in Postgres.
    const quotaBefore = (await testPool.query(
      "select login_challenge_window_count from account_mfa where account_id=$1",
      [created.data.account.id]
    )).rows[0].login_challenge_window_count;
    assert(quotaBefore >= 5 && quotaBefore <= 8,
      'The existing MFA login attempts must already count against the account quota');
    const remainingChallengeSlots = 8 - quotaBefore;
    const concurrentChallenges = await Promise.all(
      Array.from({ length: remainingChallengeSlots + 3 }, () =>
        request('POST', '/api/account/login', { body: { email, password } }))
    );
    assert.equal(concurrentChallenges.filter(result =>
      result.status === 200 && result.data.mfa_required === true
    ).length, remainingChallengeSlots, 'Only the remaining challenge slots may be issued');
    assert.equal(concurrentChallenges.filter(result =>
      result.status === 429 && result.data.error === 'MFA_CHALLENGE_RATE_LIMITED'
    ).length, 3, 'Excess password-correct logins must be rate limited across the account');
    assert.equal((await testPool.query(
      "select login_challenge_window_count from account_mfa where account_id=$1",
      [created.data.account.id]
    )).rows[0].login_challenge_window_count, 8,
    'Concurrent challenge issuance must not exceed its persisted maximum');
    const blockedChallenge = await request('POST', '/api/account/login', {
      body: { email, password }
    });
    assert.equal(blockedChallenge.status, 429);
    assert.equal(blockedChallenge.cookie, '', 'A blocked login must not issue a pending MFA cookie');
    assert.equal((await request('POST', '/api/account/mfa/login', {
      cookie: obsoletePending.cookie, body: { recovery_code: freshCodes[0] }
    })).status, 200, 'An earlier pending challenge must survive additional login requests');
    const disableCode = freshCodes[1];
    const racePending = concurrentChallenges.find(result =>
      result.status === 200 && result.data.mfa_required === true
    );
    assert(racePending?.cookie, 'A pending challenge is needed for the login-disable race');
    const [disableOne, disableTwo, racingLogin] = await Promise.all([
      request('POST', '/api/account/mfa/disable', { cookie: success.cookie, body: { recovery_code: disableCode } }),
      request('POST', '/api/account/mfa/disable', { cookie: success.cookie, body: { recovery_code: disableCode } }),
      request('POST', '/api/account/mfa/login', {
        cookie: racePending.cookie, body: { recovery_code: freshCodes[3] }
      })
    ]);
    const disableAttempts = [disableOne, disableTwo];
    assert([200, 401].includes(racingLogin.status),
      'A racing MFA login must succeed before disable or fail after disable, never deadlock');
    if (racingLogin.status === 200) {
      assert.equal((await request('GET', '/api/account/me', { cookie: racingLogin.cookie })).data.authenticated,
        false, 'Disabling MFA must also invalidate a newly issued racing session');
    }
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

    // Isolated PostgreSQL HTTP acceptance: PlayStation sync only uses a paired,
    // non-revoked launcher, and malformed messages never cause partial writes.
    const bridge = deviceId => ({
      'x-cfs-launcher-secret': ciLauncherSecret,
      'x-cfs-device-id': deviceId
    });
    async function pairDevice(cookie, label) {
      const registered = await request('POST', '/api/launcher/devices/register', {
        extraHeaders: bridge('00000000-0000-4000-8000-000000000000'),
        body: { machine_name: label }
      });
      assert.equal(registered.status, 201, 'Device registration requires configured bridge credential');
      const code = registered.data.device.user_code;
      const linked = await request('POST', '/api/creator/launcher/device-link/confirm', {
        cookie, body: { user_code: code }
      });
      assert.equal(linked.status, 200, 'Device pairing must be confirmed by its owner');
      return registered.data.device.id;
    }
    const psCookie = disabledAccountLogin.cookie;
    const deviceOne = await pairDevice(psCookie, 'PostgreSQL PlayStation A');
    const deviceTwo = await pairDevice(psCookie, 'PostgreSQL PlayStation B');
    const foreignDevice = await pairDevice(otherCookie, 'PostgreSQL PlayStation Foreign');
    assert.equal((await request('POST', '/api/launcher/playstation/sync', {
      body: { games: [] }
    })).status, 401, 'Unauthenticated device must not synchronize');
    assert.equal((await request('POST', '/api/launcher/playstation/sync', {
      extraHeaders: bridge('bad-device-id'), body: { games: [] }
    })).status, 400, 'Malformed device IDs must be rejected before PostgreSQL');
    assert.equal((await request('POST', '/api/launcher/playstation/sync', {
      extraHeaders: bridge(deviceOne), body: { games: [{
        title: 'Invalid calendar entry', last_played_at: '2026-02-30T12:00:00Z'
      }] }
    })).status, 400, 'Invalid calendar dates must be rejected');
    assert.equal((await request('POST', '/api/launcher/playstation/sync', {
      extraHeaders: bridge(deviceOne), body: { videos: [{
        title: 'Private host', url: 'https://localhost./secret'
      }] }
    })).status, 400, 'Trailing-dot internal URLs must be rejected');
    assert.equal((await request('GET', '/api/creator/playstation', { cookie: psCookie })).data.connected,
      false, 'Rejected imports cannot mark a previously unused profile connected');
    const videoUrl = 'https://videos.example.com/highlight/one';
    const firstPayload = {
      profile: { platform: 'PS5', display_name: 'CI Player' },
      games: [{ title: 'Racing', platform: 'PS5',
        cover_url: 'https://cdn.example.com/cover.jpg',
        last_played_at: '2026-11-12T19:00:00Z', in_catalog: true }],
      videos: [{ title: 'First Highlight', url: videoUrl }]
    };
    const firstSync = await request('POST', '/api/launcher/playstation/sync', {
      extraHeaders: bridge(deviceOne), body: firstPayload
    });
    assert.equal(firstSync.status, 200, 'Valid sync failed: ' + JSON.stringify(firstSync.data));
    assert.equal(firstSync.data.account_id, undefined,
      'Sync response must not disclose the paired account ID');
    const firstState = (await request('GET', '/api/creator/playstation', {
      cookie: psCookie
    })).data;
    assert.equal(firstState.connected, true);
    assert.equal(firstState.online, true,
      'A just-synced active launcher should be presented as online');
    assert.equal(firstState.sync_state, 'current',
      'Recently synced PlayStation data must be reported current');
    assert.equal(firstState.active_game, null,
      'Previously recorded game history cannot prove a live game');
    assert.equal(firstState.game_catalog.length, 1);
    assert.equal(firstState.videos.length, 1);
    const initialVideoId = firstState.videos[0].id;
    const replaySync = await request('POST', '/api/launcher/playstation/sync', {
      extraHeaders: bridge(deviceOne), body: firstPayload
    });
    assert.equal(replaySync.status, 200);
    const replayState = (await request('GET', '/api/creator/playstation', {
      cookie: psCookie
    })).data;
    assert.equal(replayState.game_catalog.length, 1,
      'Repeated games must use the existing unique catalog row');
    assert.equal(replayState.videos.length, 1,
      'Repeated video URLs must not duplicate rows');
    assert.equal(replayState.videos[0].id, initialVideoId,
      'Repeated video updates must preserve existing IDs');
    assert.equal((await request('POST', '/api/launcher/playstation/sync', {
      extraHeaders: bridge(deviceOne),
      body: { games: [{ title: 'Never committed', platform: 'PS5' }],
        videos: [{ title: 'Rejected', url: 'http://127.0.0.1/private' }] }
    })).status, 400, 'One invalid video must invalidate the entire sync payload');
    assert.equal((await request('GET', '/api/creator/playstation', {
      cookie: psCookie
    })).data.game_catalog.length, 1,
    'Invalid batch must not create partial game rows');
    const concurrent = await Promise.all([deviceOne, deviceTwo].map(id =>
      request('POST', '/api/launcher/playstation/sync', {
        extraHeaders: bridge(id), body: {
          videos: [{ title: 'Updated Highlight', url: videoUrl }]
        }
      })
    ));
    assert.deepEqual(concurrent.map(x => x.status), [200, 200],
      'Two active devices of the same creator must serialize safely');
    const parallelState = (await request('GET', '/api/creator/playstation', {
      cookie: psCookie
    })).data;
    assert.equal(parallelState.videos.length, 1);
    assert.equal(parallelState.videos[0].id, initialVideoId);
    assert.equal(parallelState.videos[0].title, 'Updated Highlight');
    assert.equal((await request('POST', '/api/launcher/playstation/sync', {
      extraHeaders: bridge(deviceOne), body: { videos: [] }
    })).status, 200);
    assert.equal((await request('GET', '/api/creator/playstation', {
      cookie: psCookie
    })).data.videos.length, 1,
    'Empty video sync must not silently delete historical data in this release');
    const foreignState = (await request('GET', '/api/creator/playstation', {
      cookie: otherCookie
    })).data;
    assert.equal(foreignState.connected, false,
      'Creator B must not see creator A PlayStation profile');
    assert.deepEqual(foreignState.videos, []);
    assert.equal((await request('POST', '/api/launcher/playstation/sync', {
      extraHeaders: bridge(foreignDevice),
      body: { games: [{ title: 'Private B Game', platform: 'PC' }] }
    })).status, 200);
    assert.equal((await request('GET', '/api/creator/playstation', {
      cookie: psCookie
    })).data.game_catalog.some(game => game.title === 'Private B Game'), false,
    'A paired launcher may write only to its own creator account');
    assert.equal((await request('DELETE', '/api/creator/launcher/devices/' + deviceOne, {
      cookie: psCookie
    })).status, 200);
    assert.equal((await request('POST', '/api/launcher/playstation/sync', {
      extraHeaders: bridge(deviceOne), body: { games: [] }
    })).status, 403, 'Revoked devices must not sync');
    assert.equal((await request('POST', '/api/launcher/playstation/sync', {
      extraHeaders: bridge(deviceTwo), body: { profile: { display_name: 'Still connected' } }
    })).status, 200, 'A separate active paired device may continue syncing');
    const currentPs = (await request('GET', '/api/creator/playstation', {
      cookie: psCookie
    })).data;
    assert.equal(currentPs.sync_state, 'current');
    assert.equal(currentPs.online, true);
    // These mutations target only the locally disposable CI database.
    // Historical account activity must never be misrepresented as live status.
    await testPool.query(
      "update launcher_devices set last_seen_at=now()-interval '5 minutes' where id=$1",
      [deviceTwo]
    );
    const offlinePs = (await request('GET', '/api/creator/playstation', {
      cookie: psCookie
    })).data;
    assert.equal(offlinePs.sync_state, 'offline');
    assert.equal(offlinePs.online, false);
    assert.equal(offlinePs.active_game, null);
    assert.equal(offlinePs.game_catalog.length, 1,
      'Going offline preserves historical games');
    await testPool.query(
      "update launcher_devices set last_seen_at=now() where id=$1",
      [deviceTwo]
    );
    await testPool.query(
      "update creator_playstation_profiles set updated_at=now()-interval '15 minutes' where account_id=$1",
      [created.data.account.id]
    );
    const stalePs = (await request('GET', '/api/creator/playstation', {
      cookie: psCookie
    })).data;
    assert.equal(stalePs.sync_state, 'stale');
    assert.equal(stalePs.launcher_online, true);
    assert.equal(stalePs.online, false);
    assert.equal(stalePs.last_synced_at !== null, true);
    assert.equal(stalePs.active_game, null);

  } finally {
    await testPool.end();
  }
  console.log('PostgreSQL E2E passed: registration, duplicate rejection, password check, account isolation, scene/widget ownership, creator CRUD, logout and admin denial.');
} finally {
  server.kill('SIGTERM');
  await delay(300);
  if (server.exitCode === null) server.kill('SIGKILL');
}
