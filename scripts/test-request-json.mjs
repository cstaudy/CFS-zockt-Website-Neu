import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readJson } from '../src/request-json.js';

const request = (chunks, headers = {}) => Object.assign(Readable.from(chunks.map(part => Buffer.from(part))), { headers });

assert.deepEqual(await readJson(request(['{"name":"CFS",', '"active":true}'])), { name: 'CFS', active: true });
assert.deepEqual(await readJson(request(['{"count":2}'], { 'content-length': '11' })), { count: 2 });
assert.deepEqual(await readJson(request([])), {});
assert.deepEqual(await readJson(request(['  '])), {});
await assert.rejects(readJson(request(['{"invalid":'])), { message: 'INVALID_JSON', status: 400 });
await assert.rejects(readJson(request(['12345678901']), 10), { message: 'PAYLOAD_TOO_LARGE', status: 413 });
// The limit is measured in bytes, including multi-byte UTF-8 characters.
await assert.rejects(readJson(request(['"€"']), 4), { message: 'PAYLOAD_TOO_LARGE', status: 413 });
console.log('JSON request bodies: chunked, content-length, empty, invalid and size-limit tests passed.');
