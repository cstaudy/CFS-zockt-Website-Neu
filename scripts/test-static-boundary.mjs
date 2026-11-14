import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, writeFile, unlink, rmdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); });
});
const uploadRoot = await mkdtemp(join(tmpdir(), 'cfs-upload-test-'));
await writeFile(join(uploadRoot, 'probe.txt'), 'mounted upload');
const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), ASSET_UPLOAD_ROOT: uploadRoot };
delete env.DATABASE_URL;
delete env.APP_BASE_URL;
const server = spawn(process.execPath, ['server.js'], { cwd: new URL('..', import.meta.url), env, stdio: ['ignore', 'ignore', 'pipe'] });
let serverErrors = '';
server.stderr.on('data', chunk => { serverErrors = (serverErrors + chunk.toString()).slice(-4000); });
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch { /* server still starting */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(ready, `Server did not start: ${serverErrors}`);
  for (const path of ['/', '/pages/login.html', '/assets/css/styles.css', '/widgets/scene.html', '/games/runtime.html', '/auth/tiktok/callback.html', '/.well-known/security.txt', '/config/monetization.json']) {
    assert.equal((await fetch(base + path)).status, 200, `${path} should be public`);
  }
  // This OBS page embeds a signed bearer token in its query string. Neither
  // static assets nor later same-origin navigation may receive that full URL
  // through Referer, and the HTML should never remain in a shared cache.
  const signedPage = base + '/widgets/stream-maker.html?token=' +
    '123e4567-e89b-42d3-a456-426614174001' + 'a'.repeat(43) + '&element=counter';
  for (const method of ['GET', 'HEAD']) {
    const response = await fetch(signedPage, { method });
    assert.equal(response.status, 200, 'Signed OBS document must remain accessible');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer',
      'OBS bearer URL must not leak through same-origin Referer');
    assert.equal(response.headers.get('cache-control'), 'no-store',
      'Signed OBS document must not be cached');
    assert.match(response.headers.get('x-robots-tag') || '', /noindex/,
      'OBS output cannot be indexed');
    if (method === 'GET') {
      const page = await response.text();
      assert.match(page, /meta name="referrer" content="no-referrer"/);
      assert.match(page, /stream-maker-output\\.js/);
    }
  }
  const ordinaryPage = await fetch(base + '/widgets/scene.html');
  assert.equal(ordinaryPage.headers.get('referrer-policy'),
    'strict-origin-when-cross-origin', 'Other site pages retain global referrer behavior');
  assert.equal(ordinaryPage.headers.get('cache-control'), 'no-cache',
    'Other HTML caching policy remains untouched');
  const sharedCss = await fetch(base + '/assets/css/stream-maker-output.css');
  assert.equal(sharedCss.headers.get('cache-control'), 'public, max-age=3600',
    'Public static CSS may remain cacheable');

  for (const page of (await readdir(new URL('../pages/', import.meta.url))).filter(name => name.endsWith('.html'))) {
    assert.equal((await fetch(`${base}/pages/${page}`)).status, 200, `${page} should be reachable`);
  }
  for (const path of ['/server.js', '/src/auth.js', '/scripts/migrate.js', '/migrations/001_initial.sql', '/package.json', '/.env.example', '/.git/config', '/codex_handover/brand/cfs-zockt-mark-clean.png', '/assets/../server.js']) {
    assert.equal((await fetch(base + path)).status, 403, `${path} should be private`);
  }
  const publicStatusResponse = await fetch(`${base}/api/public/status`);
  assert.equal(publicStatusResponse.status, 200, 'Public status endpoint must remain reachable');
  const publicStatus = await publicStatusResponse.json();
  assert.equal(publicStatus.ok, true);
  assert.equal(publicStatus.status, 'degraded', 'Without a database the site must not advertise full readiness');
  assert.match(publicStatus.message, /Anmeldung|Creator/, 'Degraded response must explain affected account functions');
  assert(!JSON.stringify(publicStatus).includes('DATABASE_URL'), 'Do not leak database configuration');

  const accountResponse = await fetch(`${base}/api/account/me`);
  assert.equal(accountResponse.status, 200);
  assert.equal((await accountResponse.json()).authenticated, false, 'Anonymous visitor must not be logged in');

  const creatorResponse = await fetch(`${base}/api/creator/projects`);
  assert.equal(creatorResponse.status, 401, 'Creator projects must require login');

  const registerResponse = await fetch(`${base}/api/account/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({
      display_name: 'Test Creator', email: 'test@example.com', password: 'test-test-test-test',
      terms_accepted: true, privacy_acknowledged: true, beta_acknowledged: true, age_18_confirmed: true
    })
  });
  assert.equal(registerResponse.status, 503, 'Registration must fail clearly when account storage is not available');

  const foreignOrigin = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: JSON.stringify({ email: 'test@example.com', password: 'invalid' })
  });
  assert.equal(foreignOrigin.status, 403, 'Cross-origin mutation should be denied');
  assert.equal((await foreignOrigin.json()).error, 'ORIGIN_NOT_ALLOWED');
  const sameOrigin = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ email: 'test@example.com', password: 'invalid' })
  });
  assert.notEqual(sameOrigin.status, 403, 'Same-origin mutation should reach the API handler');
  for (const path of ['/api/creator/media/videos', '/api/creator/media/clips', '/api/creator/widget-studio/assets']) {
    const response = await fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': path.includes('assets') ? 'image/png' : 'video/mp4', origin: base },
      body: Buffer.from('unauthenticated upload')
    });
    assert.equal(response.status, 401, `${path} should reject unauthenticated uploads`);
    assert.equal((await response.json()).error, 'AUTHENTICATION_REQUIRED');
  }
  for (const method of ['GET', 'HEAD']) {
    const response = await fetch(`${base}/assets/uploads/probe.txt`, { method });
    assert.equal(response.status, 401, 'Unregistered upload bytes must not be publicly accessible');
  }
  console.log('Static boundary: 51 HTML pages reachable; internal files denied; mounted uploads require authentication; creator uploads require authentication; cross-origin mutations denied.');
} finally {
  server.kill();
  await unlink(join(uploadRoot, 'probe.txt'));
  await rmdir(uploadRoot);
}
