import assert from 'node:assert/strict';
import { decodeUploadFilename } from '../src/upload-filename.js';

assert.equal(decodeUploadFilename(undefined), 'upload');
assert.equal(decodeUploadFilename('', 'video'), 'video');
assert.equal(decodeUploadFilename('CFS%20Logo.png'), 'CFS Logo.png');
assert.equal(decodeUploadFilename('aufnahme-2026.mp4'), 'aufnahme-2026.mp4');
assert.equal(decodeUploadFilename('gr%C3%BCn.webp'), 'grün.webp');
assert.equal(decodeUploadFilename('invalid%ZZ.webp'), null);
assert.equal(decodeUploadFilename('%E0%A4%A'), null);
console.log('Upload filename decoder: valid names accepted; malformed encodings rejected.');
