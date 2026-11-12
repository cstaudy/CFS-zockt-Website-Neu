import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const code = await readFile(new URL('../assets/js/page-login.js', import.meta.url), 'utf8');

async function loginDestination(account, search = '') {
  let onReady;
  const replaced = [];
  const origin = 'https://cfs-zockt.example.test';
  const location = {
    search,
    hash: '',
    pathname: '/pages/login.html',
    origin,
    replace(path) { replaced.push(path); }
  };
  const document = {
    addEventListener(name, callback) {
      if (name === 'DOMContentLoaded') onReady = callback;
    },
    querySelector() { return null; },
    getElementById() { return null; }
  };
  const CFS = {
    async me() {
      return { authenticated: true, account };
    }
  };
  runInNewContext(code, {
    CFS, document, location, URL, URLSearchParams,
    window: { setTimeout() {} },
    history: { replaceState() {} },
    sessionStorage: { getItem() { return null; } }
  });
  assert.equal(typeof onReady, 'function', 'Login script must initialize on DOM ready');
  await onReady();
  assert.equal(replaced.length, 1, 'Authenticated visitors must be redirected exactly once');
  return replaced[0];
}

assert.equal(await loginDestination({ admin: true, role: 'admin' }), '/pages/admin.html',
  'Approved admins should reach admin dashboard after login');
assert.equal(await loginDestination({ admin: false, role: 'creator' }), '/pages/dashboard.html',
  'Creator accounts should reach regular dashboard');
assert.equal(await loginDestination({ admin: false, role: 'admin' }), '/pages/dashboard.html',
  'A role string without approved admin authorization must not redirect to admin');
assert.equal(await loginDestination({ admin: true, role: 'admin' },
  '?returnTo=%2Fpages%2Fwidget-studio.html'), '/pages/widget-studio.html',
  'An explicitly chosen approved creator destination should be honored');
assert.equal(await loginDestination({ admin: true, role: 'admin' },
  '?returnTo=https%3A%2F%2Fevil.example%2F'), '/pages/admin.html',
  'Open redirect attempts must be ignored');
assert.equal(await loginDestination({ admin: false, role: 'creator' },
  '?returnTo=%2Fpages%2F..%2Fadmin.html'), '/pages/dashboard.html',
  'Path traversal must not override the default destination');
console.log('Login destination: admin flag, creator fallback, approved deep links and rejected unsafe redirects passed.');
