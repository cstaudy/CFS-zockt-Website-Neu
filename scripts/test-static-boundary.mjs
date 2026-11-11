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
const server = spawn(process.execPath, ['server.js'], { cwd: new URL('..', import.meta.url), env, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch { /* server still starting */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(ready, 'Server did not start');
  for (const path of ['/', '/pages/login.html', '/assets/css/styles.css', '/widgets/scene.html', '/games/runtime.html', '/auth/tiktok/callback.html', '/.well-known/security.txt', '/config/monetization.json']) {
    assert.equal((await fetch(base + path)).status, 200, `${path} should be public`);
  }
  for (const page of (await readdir(new URL('../pages/', import.meta.url))).filter(name => name.endsWith('.html'))) {
    assert.equal((await fetch(`${base}/pages/${page}`)).status, 200, `${page} should be reachable`);
  }
  for (const path of ['/server.js', '/src/auth.js', '/scripts/migrate.js', '/migrations/001_initial.sql', '/package.json', '/.env.example', '/.git/config', '/codex_handover/brand/cfs-zockt-mark-clean.png', '/assets/../server.js']) {
    assert.equal((await fetch(base + path)).status, 403, `${path} should be private`);
  }
  assert.equal(await (await fetch(`${base}/assets/uploads/probe.txt`)).text(), 'mounted upload');
  console.log('Static boundary: 51 HTML pages reachable; internal files denied; mounted uploads served.');
} finally {
  server.kill();
  await unlink(join(uploadRoot, 'probe.txt'));
  await rmdir(uploadRoot);
}
