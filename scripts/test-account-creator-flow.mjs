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
    MIGRATION_BASELINE_ON_START: 'no',
    CFS_LOGIN_THROTTLE_SOCKET_MODE: 'enabled'
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

  assert.equal((await request('GET', '/api/creator/widget-studio/packages')).status, 401,
    'Package listing must not pretend authentication succeeded');
  assert.equal((await request('POST', '/api/creator/widget-studio/packages', { body: {} })).status, 401,
    'Anonymous package creation must return HTTP 401');
  assert.equal((await request('POST', '/api/creator/widget-studio/packages', {
    cookie: created.cookie, body: null
  })).status, 400, 'Malformed package payloads must be rejected');
  const saved = await request('POST', '/api/creator/projects', {
    cookie: created.cookie,
    body: { kind: 'design', name: 'CI Design', data: { headline: 'Saved creator content' } }
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

  // Scene Studio must own its creation, publication and optimistic revisions.
  assert.equal((await request('POST', '/api/creator/projects', {
    cookie: created.cookie, body: { kind: 'scene', name: 'Shortcut Scene', data: {} }
  })).status, 409, 'Generic projects cannot create Scenes outside the quota');
  assert.equal((await request('PATCH', '/api/creator/projects/' + sceneId, {
    cookie: created.cookie, body: { name: 'Changed outside Scene Studio' }
  })).status, 409, 'Generic project changes must not bypass Scene Studio versioning');
  assert.equal((await request('POST', '/api/creator/widget-studio/scenes', {
    cookie: created.cookie, body: { config: null }
  })).status, 400, 'Malformed scene configurations must be rejected');
  assert.equal((await request('POST', '/api/creator/widget-studio/scenes/' + sceneId + '/publish', {
    cookie: created.cookie, body: { expected_version: sceneCreated.data.scene.version }
  })).status, 400, 'Incomplete scene drafts cannot be advertised as OBS-ready');
  const firstSceneConfig = { profile: 'landscape', canvas: {
    width: 1920, height: 1080, background: 'transparent'
  }, items: [{ id: 'ci_board_widget', widget_id: widgetId, visible: true,
    x: 30, y: 70, scale: 1, opacity: 1, rotation: 0, z_index: 0 }] };
  const sceneDraft = await request('PUT', '/api/creator/widget-studio/scenes/' + sceneId, {
    cookie: created.cookie, body: { expected_version: sceneCreated.data.scene.version, config: firstSceneConfig }
  });
  assert.equal(sceneDraft.status, 200, `Scene draft save failed: ${JSON.stringify(sceneDraft.data)}`);
  assert.equal((await request('GET', '/api/public/scenes/' + sceneId)).status, 404,
    'Unpublished scene layouts must remain private');
  assert.equal((await request('POST', '/api/creator/widget-studio/scenes/' + sceneId + '/publish', {
    cookie: created.cookie, body: { expected_version: sceneDraft.data.scene.version }
  })).status, 409, 'Scene publication must reject draft or foreign widgets');
  const widgetPublished = await request('POST', '/api/creator/widget-studio/widgets/' + widgetId + '/publish', {
    cookie: created.cookie, body: { expected_version: widgetCreated.data.widget.version }
  });
  assert.equal(widgetPublished.status, 200, `Widget publication failed: ${JSON.stringify(widgetPublished.data)}`);
  const scenePublished = await request('POST', '/api/creator/widget-studio/scenes/' + sceneId + '/publish', {
    cookie: created.cookie, body: { expected_version: sceneDraft.data.scene.version }
  });
  assert.equal(scenePublished.status, 200, `Scene publication failed: ${JSON.stringify(scenePublished.data)}`);
  assert.equal(scenePublished.data.scene.status, 'live');
  assert.match(scenePublished.data.scene.source_url, /\/widgets\/scene\.html\?scene=/);
  const publicScene = await request('GET', '/api/public/scenes/' + sceneId);
  assert.equal(publicScene.status, 200);
  assert.equal(publicScene.data.scene.items[0].widget_id, widgetId);
  assert.equal(publicScene.data.scene.items[0].x, 30);
  const changedScene = await request('PUT', '/api/creator/widget-studio/scenes/' + sceneId, {
    cookie: created.cookie,
    body: { expected_version: scenePublished.data.scene.version,
      config: { ...firstSceneConfig, items: [{ ...firstSceneConfig.items[0], x: 88 }] } }
  });
  assert.equal(changedScene.status, 200);
  assert.equal(changedScene.data.scene.has_unpublished_changes, true);
  assert.equal((await request('GET', '/api/public/scenes/' + sceneId)).data.scene.items[0].x, 30,
    'Later scene draft changes must not leak into its published OBS output');
  assert.equal((await request('PUT', '/api/creator/widget-studio/scenes/' + sceneId, {
    cookie: created.cookie, body: { expected_version: sceneDraft.data.scene.version, name: 'Stale' }
  })).status, 409, 'Scene concurrent edits must reject stale revisions');

  // Stream Maker: authenticated storage, owner isolation, bearer-source rotation and deletion.
  assert.equal((await request('GET', '/api/creator/stream-maker')).status, 401,
    'Anonymous visitors cannot enumerate private maker bundles');
  const makerCreated = await request('POST', '/api/creator/stream-maker', {
    cookie: created.cookie,
    body: { config: { name: 'CI Stream Maker', elements: [
      { id: 'ci_counter', template: 'counter', value: 0 }
    ] } }
  });
  assert.equal(makerCreated.status, 201, `Stream Maker create failed: ${JSON.stringify(makerCreated.data)}`);
  assert.equal((await request('POST', '/api/creator/projects', {
    cookie: created.cookie,
    body: { kind: 'stream', name: 'Reserved maker type', data: { type: 'stream_maker' } }
  })).status, 409, 'Reserved maker projects require the dedicated endpoint');
  const makerId = makerCreated.data.bundle.id;
  assert.equal((await request('PATCH', '/api/creator/projects/' + makerId, {
    cookie: created.cookie, body: { data: { type: 'stream_maker', config: {} } }
  })).status, 409, 'Maker changes require its own API');
  assert.equal((await request('DELETE', '/api/creator/projects/' + makerId, {
    cookie: created.cookie
  })).status, 409, 'Maker deletion follows dedicated revision checks');
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const guarded = await request(method, '/api/creator/stream-studio/projects/' + makerId, {
      cookie: created.cookie, ...(method === 'PUT' ? { body: { title:'Tampered', config:{} } } : {})
    });
    assert.equal(guarded.status, 404, 'Generic stream project API must not mutate a Maker bundle');
  }
  const makerToken = makerCreated.data.bundle.public_token;
  assert.match(makerToken, /^[0-9a-f-]{36}[A-Za-z0-9_-]{43}$/i);
  const makerPublic = await request('GET', '/api/public/stream-maker/' + makerToken);
  assert.equal(makerPublic.status, 200, `Maker output failed: ${JSON.stringify(makerPublic.data)}`);
  assert.equal(makerPublic.data.config.elements[0].id, 'ci_counter');
  assert.equal(makerPublic.data.public_token, undefined, 'Public Maker output must not reveal its signed token');
  assert.equal((await request('GET', '/api/creator/stream-maker', { cookie: otherCookie }))
    .data.bundles.some(bundle => bundle.id === makerId), false, 'Other creators cannot list private Maker bundles');
  assert.equal((await request('PUT', '/api/creator/stream-maker/' + makerId, {
    cookie: otherCookie, body: { version: makerCreated.data.bundle.version, config: { elements: [{ template: 'counter' }] } }
  })).status, 404, 'Other creators cannot edit private Maker bundles');
  assert.equal((await request('PUT', '/api/creator/stream-maker/' + makerId, {
    cookie: created.cookie, body: { version: 9999, config: { elements: [{ template: 'counter' }] } }
  })).status, 409, 'Maker saves must reject stale versions');
  const controlledMaker = await request('POST', '/api/creator/stream-maker/' + makerId + '/control', {
    cookie: created.cookie, body: { element: 'ci_counter', action: 'plus' }
  });
  assert.equal(controlledMaker.status, 200, `Maker control failed: ${JSON.stringify(controlledMaker.data)}`);
  assert.equal(controlledMaker.data.bundle.config.elements[0].value, 1);
  assert.equal((await request('GET', '/api/public/stream-maker/' + makerToken))
    .data.config.elements[0].value, 1, 'OBS source reflects the stored counter');
  const rotatedMaker = await request('POST', '/api/creator/stream-maker/' + makerId + '/rotate-token', {
    cookie: created.cookie, body: { version: controlledMaker.data.bundle.version }
  });
  assert.equal(rotatedMaker.status, 200);
  const newMakerToken = rotatedMaker.data.bundle.public_token;
  assert.notEqual(newMakerToken, makerToken);
  assert.equal((await request('GET', '/api/public/stream-maker/' + makerToken)).status, 404,
    'Old OBS tokens must be revoked immediately');
  assert.equal((await request('GET', '/api/public/stream-maker/' + newMakerToken)).status, 200);
  assert.equal((await request('POST', '/api/creator/stream-maker/' + makerId + '/publish', {
    cookie: created.cookie, body: { rights_confirmed: true }
  })).status, 403, 'Creator cannot publish Shop templates without admin rights');
  const makerDeleted = await request('DELETE', '/api/creator/stream-maker/' + makerId, {
    cookie: created.cookie, body: { version: rotatedMaker.data.bundle.version }
  });
  assert.equal(makerDeleted.status, 200);
  assert.equal((await request('GET', '/api/public/stream-maker/' + newMakerToken)).status, 404,
    'Deleted Maker output must stop working');

  const secondProject = await request('POST', '/api/creator/projects', {
    cookie: otherCookie, body: { kind: 'design', name: 'Private B Design', data: { secret: 'B only' } }
  });
  assert.equal(secondProject.status, 201);
  assert(!(await request('GET', '/api/creator/projects', { cookie: created.cookie }))
    .data.projects?.some(project => project.id === secondProject.data.project.id),
    'Creator A must also be unable to see creator B private data');

  // Universal Builder: only its own records and atomic revisions may be changed.
  assert.equal((await request('POST', '/api/creator/projects', {
    cookie: created.cookie, body: { kind: 'design', name: 'Wrong path', data: { type: 'universal_bundle' } }
  })).status, 409, 'Universal Builder records require their dedicated API');
  assert.equal((await request('POST', '/api/creator/universal-builder/bundles', {
    cookie: created.cookie, body: { name: 'Invalid config', config: [] }
  })).status, 400, 'Universal Builder must reject malformed configurations');
  const builderCreated = await request('POST', '/api/creator/universal-builder/bundles', {
    cookie: created.cookie,
    body: { name: 'Builder CI', config: { design_key: 'blitze', platforms: ['obs'],
      elements: [{ type: 'text', id: 'main' }], settings: {} } }
  });
  assert.equal(builderCreated.status, 201, `Builder save failed: ${JSON.stringify(builderCreated.data)}`);
  const builderId = builderCreated.data.bundle.id;
  const builderVersion = builderCreated.data.bundle.version;
  assert.equal((await request('PUT', '/api/creator/universal-builder/bundles/' + builderId, {
    cookie: otherCookie, body: { name: 'Foreign change', version: builderVersion, config: {} }
  })).status, 404, 'Builder updates must isolate owners');
  assert.equal((await request('PATCH', '/api/creator/projects/' + builderId, {
    cookie: created.cookie, body: { name: 'Outside builder' }
  })).status, 409, 'Generic project edits must not bypass Builder version checks');
  assert.equal((await request('DELETE', '/api/creator/projects/' + builderId, {
    cookie: created.cookie
  })).status, 409, 'Generic project removal must not bypass Builder version checks');
  assert.equal((await request('PUT', '/api/creator/universal-builder/bundles/' + projectId, {
    cookie: created.cookie, body: { name: 'Cross-type', version: builderVersion, config: {} }
  })).status, 404, 'Builder cannot overwrite an ordinary design belonging to the same creator');
  const racePayload = { version: builderVersion, config: { design_key: 'nacht',
    platforms: ['obs'], elements: [{ type: 'shape' }], settings: {} } };
  const builderRace = await Promise.all([
    request('PUT', '/api/creator/universal-builder/bundles/' + builderId, {
      cookie: created.cookie, body: { ...racePayload, name: 'Race A' }
    }),
    request('PUT', '/api/creator/universal-builder/bundles/' + builderId, {
      cookie: created.cookie, body: { ...racePayload, name: 'Race B' }
    })
  ]);
  assert.deepEqual(builderRace.map(item => item.status).sort((a, b) => a - b), [200, 409],
    'Only one concurrent Builder save with an old version may succeed');
  const builderNewVersion = builderRace.find(item => item.status === 200).data.bundle.version;
  assert.equal((await request('PATCH', '/api/creator/universal-builder/bundles/' + builderId + '/name', {
    cookie: created.cookie, body: { name: 'Stale rename', version: builderVersion }
  })).status, 409, 'Builder rename rejects stale revisions');
  const builderRenamed = await request('PATCH', '/api/creator/universal-builder/bundles/' + builderId + '/name', {
    cookie: created.cookie, body: { name: 'Safe rename', version: builderNewVersion }
  });
  assert.equal(builderRenamed.status, 200);
  assert.equal((await request('DELETE', '/api/creator/universal-builder/bundles/' + builderId, {
    cookie: created.cookie, body: { version: builderNewVersion }
  })).status, 409, 'Builder deletion rejects stale revisions');
  assert.equal((await request('DELETE', '/api/creator/universal-builder/bundles/' + builderId, {
    cookie: created.cookie, body: { version: builderRenamed.data.bundle.version }
  })).status, 200, 'Owner may archive current Builder revision');
  assert(!(await request('GET', '/api/creator/universal-builder', { cookie: created.cookie }))
    .data.bundles?.some(row => row.id === builderId), 'Archived Builder bundles must not appear in active lists');

  // Cut Studio: detail response includes timeline clips and the combined save is atomic.
  const cutCreated = await request('POST', '/api/creator/cut-studio/projects', {
    cookie: created.cookie, body: { title: 'CI Cut Timeline', format: 'landscape' }
  });
  assert.equal(cutCreated.status, 201, `Cut project failed: ${JSON.stringify(cutCreated.data)}`);
  const cutId = cutCreated.data.project.id;
  const cutOpened = await request('GET', '/api/creator/cut-studio/projects/' + cutId, {
    cookie: created.cookie
  });
  assert.equal(cutOpened.status, 200);
  assert.equal(cutOpened.data.project.title, 'CI Cut Timeline');
  assert.deepEqual(cutOpened.data.clips, []);
  assert.equal((await request('GET', '/api/creator/cut-studio/projects/' + cutId, {
    cookie: otherCookie
  })).status, 404, 'Foreign account cannot read a Cut timeline');
  const newClip = await request('POST', '/api/creator/cut-studio/projects/' + cutId + '/clips', {
    cookie: created.cookie, body: { base_updated_at:cutOpened.data.project.updated_at,expected_version:cutOpened.data.project.version, label: 'First Clip', in_ms: 0, out_ms: 15000, id: 'attacker-defined-id', updated_at: '2000-01-01T00:00:00.000Z' }
  });
  assert.equal(newClip.status, 201, `Cut clip create failed: ${JSON.stringify(newClip.data)}`);
  assert.match(newClip.data.clip.id, /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i, "Cut clip IDs must be server-generated");
  assert.notEqual(newClip.data.clip.updated_at, "2000-01-01T00:00:00.000Z", "Client timestamps cannot replace server clip revisions");
  assert.equal((await request("POST", "/api/creator/cut-studio/projects/" + cutId + "/clips", {
    cookie: created.cookie, body: { base_updated_at:newClip.data.project_updated_at,expected_version:newClip.data.project_version,label:"Bad negative clip", in_ms:-1, out_ms:5000 }
  })).status, 400, "Clip bounds must be checked server-side");
  const cutAfterClip = await request('GET', '/api/creator/cut-studio/projects/' + cutId, {
    cookie: created.cookie
  });
  assert.equal(cutAfterClip.data.clips.length, 1);
  assert.equal(cutAfterClip.data.clips[0].id, newClip.data.clip.id);
  assert.equal((await request('POST', '/api/creator/cut-studio/projects/' + cutId + '/clips', {
    cookie: created.cookie,
    body: { base_updated_at:cutOpened.data.project.updated_at,expected_version:cutOpened.data.project.version,
      label:'Concurrent stale create',in_ms:0,out_ms:2000 }
  })).status, 409, 'Outdated clip additions must not overwrite another edit');
  assert.equal((await request('PUT', '/api/creator/cut-studio/projects/' + cutId + '/clips/order', {
    cookie: created.cookie, body: { base_updated_at:cutAfterClip.data.project.updated_at,
      expected_version:cutAfterClip.data.project.version, clip_ids:[newClip.data.clip.id,newClip.data.clip.id] }
  })).status, 400, 'Duplicate clip IDs must be rejected when sorting');
  assert.equal((await request('DELETE', '/api/creator/cut-studio/projects/' + cutId + '/clips/' + newClip.data.clip.id, {
    cookie:otherCookie, body: { project_base_updated_at:cutAfterClip.data.project.updated_at,
      clip_base_updated_at:newClip.data.clip.updated_at }
  })).status, 404, 'Foreign clips cannot be deleted');

  const combined = await request('PUT', '/api/creator/cut-studio/projects/' + cutId + '/save', {
    cookie: created.cookie,
    body: { project: { title: 'Cut Timeline Saved', format: 'vertical',
      expected_version: cutAfterClip.data.project.version },
      clips: [{ ...cutAfterClip.data.clips[0], base_updated_at: cutAfterClip.data.clips[0].updated_at,
        caption: 'Safe updated caption' }] }
  });
  assert.equal(combined.status, 200, `Atomic Cut save failed: ${JSON.stringify(combined.data)}`);
  assert.equal(combined.data.project.title, 'Cut Timeline Saved');
  assert.equal(combined.data.clips[0].caption, 'Safe updated caption');
  assert.equal((await request('PUT', '/api/creator/cut-studio/projects/' + cutId + '/save', {
    cookie: created.cookie,
    body: { project: { title: 'Stale', expected_version: cutAfterClip.data.project.version },
      clips: [{ ...cutAfterClip.data.clips[0], base_updated_at: cutAfterClip.data.clips[0].updated_at }] }
  })).status, 409, 'Stale Cut Studio revisions cannot overwrite a committed timeline');
  const cutStillSaved = await request('GET', '/api/creator/cut-studio/projects/' + cutId, {
    cookie: created.cookie
  });
  assert.equal(cutStillSaved.data.project.title, 'Cut Timeline Saved');
  assert.equal(cutStillSaved.data.clips[0].caption, 'Safe updated caption');
  assert.equal((await request('PUT', '/api/creator/cut-studio/projects/' + cutId + '/save', {
    cookie: otherCookie, body: { project: { title: 'Foreign', expected_version: combined.data.project.version }, clips: [] }
  })).status, 404, 'Foreign accounts cannot alter Cut project and clips together');

  // Stream Studio uses one account-scoped record and rejects concurrent stale saves.
  assert.equal((await request('GET', '/api/creator/stream-studio')).status, 401,
    'Stream Studio state requires authentication');
  const streamInitial = await request('GET', '/api/creator/stream-studio', { cookie: created.cookie });
  assert.equal(streamInitial.status, 200);
  assert.equal(streamInitial.data.version, null);
  assert.equal(streamInitial.data.scenes.some(item => item.id === sceneId), true,
    'Stream Studio must receive the creator\'s actual scenes');
  assert.equal(streamInitial.data.widgets.some(item => item.id === widgetId), true,
    'Stream Studio must receive the creator\'s actual widgets');
  const firstStream = await request('PUT', '/api/creator/stream-studio', {
    cookie: created.cookie,
    body: { expected_version: null, config: { program_scene_id:sceneId, scene_order:[sceneId] } }
  });
  assert.equal(firstStream.status, 200, `Stream Studio first save failed: ${JSON.stringify(firstStream.data)}`);
  const secondStream = await request('PUT', '/api/creator/stream-studio', {
    cookie: created.cookie,
    body: { expected_version:firstStream.data.version, config: { program_scene_id:sceneId, scene_order:[sceneId], preview_scene_id:sceneId } }
  });
  assert.equal(secondStream.status, 200);
  assert.equal((await request('PUT', '/api/creator/stream-studio', {
    cookie: created.cookie,
    body: { expected_version:firstStream.data.version, config: { program_scene_id:'stale' } }
  })).status, 409, 'Stream Studio must reject an outdated edit');
  const streamState = await request('GET', '/api/creator/stream-studio', { cookie:created.cookie });
  assert.equal(streamState.data.version, secondStream.data.version);
  assert.equal(streamState.data.config.preview_scene_id, sceneId);
  assert.equal((await request('GET', '/api/creator/stream-studio', { cookie:otherCookie }))
    .data.config.program_scene_id, undefined, 'Second creator must not see the first Stream Studio workspace');
  const streamRows = (await request('GET', '/api/creator/projects?kind=stream', { cookie:created.cookie }))
    .data.projects.filter(item => item.data?.type === 'stream_studio');
  assert.equal(streamRows.length, 1, 'Repeated Stream Studio saves must not create duplicate projects');
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const guarded = await request(method, '/api/creator/stream-studio/projects/' + streamRows[0].id, {
      cookie: created.cookie, ...(method === 'PUT' ? { body: { title:'Tampered', config:{} } } : {})
    });
    assert.equal(guarded.status, 404, 'Generic stream project API must not mutate the Stream Studio state');
  }


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

  // OBS images use a source-specific capability instead of exposing private uploads globally.
  const makerWithImage = await request('POST', '/api/creator/stream-maker', {
    cookie: login.cookie, body: { config: {
      name: 'Private image OBS source', source: asset.data.asset.url,
      elements: [{ id: 'ci_image', template: 'camera' }]
    } }
  });
  assert.equal(makerWithImage.status, 201, `Maker image setup failed: ${JSON.stringify(makerWithImage.data)}`);
  const imageToken = makerWithImage.data.bundle.public_token;
  const scopedImageUrl = base + asset.data.asset.url + '?source_token=' + imageToken;
  assert.equal((await fetch(base + asset.data.asset.url)).status, 401,
    'Private image remains inaccessible without a valid source capability');
  const scopedImage = await fetch(scopedImageUrl);
  assert.equal(scopedImage.status, 200, 'A valid OBS source can load its own referenced image');
  assert.deepEqual(Buffer.from(await scopedImage.arrayBuffer()), privateImage);
  const otherMakerWithImage = await request('POST', '/api/creator/stream-maker', {
    cookie: mediaOtherCookie, body: { config: {
      name: 'Foreign private image', source: asset.data.asset.url,
      elements: [{ id: 'foreign_image', template: 'camera' }]
    } }
  });
  assert.equal(otherMakerWithImage.status, 201);
  assert.equal((await fetch(base + asset.data.asset.url +
    '?source_token=' + otherMakerWithImage.data.bundle.public_token)).status, 401,
    'A second account cannot authorize someone else\'s image through its own OBS source');
  const imageRotated = await request('POST', '/api/creator/stream-maker/' + makerWithImage.data.bundle.id + '/rotate-token', {
    cookie: login.cookie, body: { version: makerWithImage.data.bundle.version }
  });
  assert.equal(imageRotated.status, 200);
  assert.equal((await fetch(scopedImageUrl)).status, 401,
    'Rotated OBS source tokens cannot continue accessing a private image');
  assert.equal((await fetch(base + asset.data.asset.url + '?source_token=' + imageRotated.data.bundle.public_token)).status, 200);
  assert.equal((await request('DELETE', '/api/creator/stream-maker/' + makerWithImage.data.bundle.id, {
    cookie: login.cookie, body: { version: imageRotated.data.bundle.version }
  })).status, 200);
  assert.equal((await fetch(base + asset.data.asset.url + '?source_token=' + imageRotated.data.bundle.public_token)).status, 401,
    'Deleted OBS sources cannot continue accessing private images');

  // A public project's image reference allows OBS to fetch JUST that image.
  // A different creator cannot publish someone else's asset by referencing its URL.
  // Widget publication must use its dedicated, versioned API. Generic writes cannot bypass it.
  assert.equal((await request('POST', '/api/creator/projects', {
    cookie: login.cookie, body: { kind: 'widget', name: 'Forbidden generic widget', data: {} }
  })).status, 409, 'Generic project creation must not bypass widget quotas');
  async function publishedImageWidget(cookie, name, imageUrl) {
    const createdWidget = await request('POST', '/api/creator/widget-studio/widgets', {
      cookie, body: { name, widget_type: 'obs_overlay' }
    });
    assert.equal(createdWidget.status, 201, JSON.stringify(createdWidget.data));
    const id = createdWidget.data.widget.id;
    const draft = await request('PUT', `/api/creator/widget-studio/widgets/${id}/draft`, {
      cookie,
      body: { expected_version: createdWidget.data.widget.version, config: {
        widgetType: 'obs_overlay', canvas: { width: 1920, height: 1080 },
        elements: [{ id: 'media-image', type: 'image', position: { x: 0, y: 0 },
          size: { width: 300, height: 300 }, data: { src: imageUrl } }], settings: {}
      } }
    });
    assert.equal(draft.status, 200, JSON.stringify(draft.data));
    const published = await request('POST', `/api/creator/widget-studio/widgets/${id}/publish`, {
      cookie, body: { expected_version: draft.data.widget.version }
    });
    assert.equal(published.status, 200, JSON.stringify(published.data));
    return { id, version: published.data.widget.version };
  }
  await publishedImageWidget(mediaOtherCookie, 'Foreign reference attempt', asset.data.asset.url);
  assert.equal((await fetch(base + asset.data.asset.url)).status, 401,
    'A published reference from a foreign creator must not expose the private image');

  const ownerWidget = await request('POST', '/api/creator/widget-studio/widgets', {
    cookie: login.cookie, body: { name: 'Owner OBS overlay', widget_type: 'obs_overlay' }
  });
  assert.equal(ownerWidget.status, 201);
  const ownerId = ownerWidget.data.widget.id;
  const ownerDraft = await request('PUT', `/api/creator/widget-studio/widgets/${ownerId}/draft`, {
    cookie: login.cookie,
    body: { expected_version: ownerWidget.data.widget.version, config: {
      widgetType: 'obs_overlay', canvas: { width: 1920, height: 1080 },
      elements: [{ id: 'image', type: 'image', data: { src: asset.data.asset.url } }]
    } }
  });
  assert.equal(ownerDraft.status, 200);
  assert.equal((await fetch(base + asset.data.asset.url)).status, 401,
    'A draft image reference must not grant public access');
  const ownerPublished = await request('POST', `/api/creator/widget-studio/widgets/${ownerId}/publish`, {
    cookie: login.cookie, body: { expected_version: ownerDraft.data.widget.version }
  });
  assert.equal(ownerPublished.status, 200);
  const packageCreated = await request('POST', '/api/creator/widget-studio/packages', {
    cookie: login.cookie, body: {
      name: 'Quota conversion bundle', world: 'ci-unique', outputs: ['widgets']
    }
  });
  assert.equal(packageCreated.status, 201, `Package creation failed: ${JSON.stringify(packageCreated.data)}`);
  const packageId = packageCreated.data.package.id;
  assert.equal((await request('POST', '/api/creator/shop/bundles/not-a-uuid/convert', {
    cookie: login.cookie, body: {}
  })).status, 404, 'Malformed bundle conversion IDs must not crash the server');
  const firstConversion = await request('POST', '/api/creator/shop/bundles/' + packageId + '/convert', {
    cookie: login.cookie, body: {}
  });
  assert.equal(firstConversion.status, 200, `Bundle conversion failed: ${JSON.stringify(firstConversion.data)}`);
  assert.equal(firstConversion.data.created_widgets.length, 1);
  const blockedConversion = await request('POST', '/api/creator/shop/bundles/' + packageId + '/convert', {
    cookie: login.cookie, body: {}
  });
  assert.equal(blockedConversion.status, 402,
    'Bundle conversion must honor the same widget quota as normal creation');
  const widgetCount = (await request('GET', '/api/creator/widget-studio/widgets', {
    cookie: login.cookie
  })).data.widgets.length;
  assert.equal(widgetCount, 3, 'A free creator must not exceed the three-widget limit through conversion');
  for (const method of ['GET', 'HEAD']) {
    const response = await fetch(base + asset.data.asset.url, { method });
    assert.equal(response.status, 200, 'Published OBS image must be accessible without a login');
    assert.equal(response.headers.get('cache-control'), 'private, no-store',
      'Uploads should not persist in public caches after unpublish');
    if (method === 'GET') assert.deepEqual(Buffer.from(await response.arrayBuffer()), privateImage);
  }
  assert.equal((await fetch(base + media.data.media.url)).status, 401,
    'Public overlay reference must not expose private videos');
  assert.equal((await request('DELETE', `/api/creator/projects/${ownerId}`, {
    cookie: login.cookie
  })).status, 200, 'Archiving a published widget must revoke its public assets');
  assert.equal((await fetch(base + asset.data.asset.url)).status, 401,
    'Archiving the owner widget must immediately revoke anonymous access');
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

  } finally {
    await testPool.end();
  }
  console.log('PostgreSQL E2E passed: registration, duplicate rejection, password check, account isolation, scene/widget ownership, creator CRUD, logout and admin denial.');
} finally {
  server.kill('SIGTERM');
  await delay(300);
  if (server.exitCode === null) server.kill('SIGKILL');
}
