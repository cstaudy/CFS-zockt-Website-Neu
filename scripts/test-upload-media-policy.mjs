import assert from "node:assert/strict";
import { uploadStorageExtension, uploadDeliveryHeaders, validImageSignature } from "../src/upload-media-policy.js";

const accepted = {
  "image/png": [".png", "image/png"],
  "image/jpeg": [".jpg", "image/jpeg"],
  "image/webp": [".webp", "image/webp"],
  "image/gif": [".gif", "image/gif"],
  "video/mp4": [".mp4", "video/mp4"],
  "video/webm": [".webm", "video/webm"],
  "video/quicktime": [".mov", "video/quicktime"],
  "video/x-matroska": [".mkv", "video/x-matroska"]
};
for (const [mime, [extension, expected]] of Object.entries(accepted)) {
  assert.equal(uploadStorageExtension(mime), extension);
  assert.deepEqual(uploadDeliveryHeaders("original-name-is-not-trusted" + extension),
    { "content-type": expected });
}
assert.deepEqual(uploadDeliveryHeaders("old-photo.jpeg"), { "content-type": "image/jpeg" },
  "Existing JPEG uploads may retain their .jpeg suffix");
for (const mime of ["text/html", "application/javascript", "image/svg+xml",
  "application/pdf", "application/octet-stream", "", null, undefined, "IMAGE/PNG"]) {
  assert.equal(uploadStorageExtension(mime), null, "Unsupported MIME cannot produce a stored upload filename");
}
const forbidden = [
  "legacy.html", "legacy.HTM", "legacy.svg", "legacy.js", "legacy.css",
  "legacy.xml", "legacy.json", "legacy.txt", "legacy.pdf",
  "legacy.webmanifest", "legacy", "legacy.exe", "legacy..html"
];
for (const name of forbidden) {
  const h = uploadDeliveryHeaders(name);
  assert.equal(h["content-type"], "application/octet-stream");
  assert.equal(h["content-disposition"], 'attachment; filename="download"',
    "Never render legacy untrusted file extensions as same-origin active documents");
  assert(!JSON.stringify(h).includes(name), "Never reflect an untrusted stored filename into the response");
}

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNg+M/wHwAEAQH/cetH5QAAAABJRU5ErkJggg==",
  "base64"
);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const gif = Buffer.from([0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00]);
const webp = Buffer.from([0x52,0x49,0x46,0x46,0x18,0x00,0x00,0x00,
  0x57,0x45,0x42,0x50,0x56,0x50,0x38,0x20]);
const known = new Map([
  ["image/png", png], ["image/jpeg", jpeg],
  ["image/gif", gif], ["image/webp", webp]
]);
for (const [mime, bytes] of known) {
  assert.equal(validImageSignature(mime, bytes), true,
    mime + " header must be accepted");
  for (const [other, otherBytes] of known) {
    if (other !== mime) assert.equal(validImageSignature(mime, otherBytes), false,
      mime + " must not accept " + other + " image headers");
  }
  assert.equal(validImageSignature(mime, Buffer.from("<!doctype html><script>alert(1)</script>")), false,
    mime + " must reject HTML content even with a spoofed Content-Type");
  assert.equal(validImageSignature(mime, bytes.subarray(0, 3)), false,
    mime + " must reject truncated headers");
}
assert.equal(validImageSignature("image/png", png.subarray(0, 16)), false);
assert.equal(validImageSignature("image/gif", Buffer.from("GIF80a0000")), false);
assert.equal(validImageSignature("image/webp",
  Buffer.from("RIFF1234WEBPNOPE")), false);
assert.equal(validImageSignature("image/png", "iVBORw0KGgo"), false,
  "Content must be binary bytes");
assert.equal(validImageSignature("text/html", png), false,
  "Unsupported MIME types must be rejected even if bytes look like an image");
console.log("Upload media policy: MIME-derived extensions validated image signatures and safe attachment fallback for active legacy filenames.");
