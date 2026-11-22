import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const server = await readFile(new URL('server.js', root), 'utf8');
const client = await readFile(new URL('assets/js/cfs-public-content-v181.js', root), 'utf8');

assert.match(server, /url\.pathname === "\/api\/public\/site-content"[\s\S]*?return json\(res, 200, \{ ok: true, available: false, source: "static_page_defaults", content: \{\} \}\)/,
  'Public site content must use explicit static fallback, not 501');
let requested = false;
const document = { readyState: 'complete', querySelectorAll: () => [], getElementById: () => null };
const fetch = async path => {
  assert.equal(path, '/api/public/site-content');
  requested = true;
  return { ok: true, json: async () => ({ ok: true, content: {} }) };
};
runInNewContext(client, { document, fetch, console });
await new Promise(resolve => setImmediate(resolve));
assert(requested, 'Homepage must request the public content endpoint');
console.log('Site content: API static fallback contract and client compatibility verified.');
