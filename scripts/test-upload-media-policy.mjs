import assert from "node:assert/strict";
import { uploadStorageExtension, uploadDeliveryHeaders, validImageSignature, validVideoSignature } from "../src/upload-media-policy.js";

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
    { "content-type": expected, "x-content-type-options": "nosniff" });
}
assert.deepEqual(uploadDeliveryHeaders("old-photo.jpeg"), { "content-type": "image/jpeg", "x-content-type-options": "nosniff" },
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
  assert.equal(h["x-content-type-options"], "nosniff", "Legacy uploads must not be MIME-sniffed");
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

function ftyp(brand) {
  const data = Buffer.alloc(20);
  data.writeUInt32BE(20, 0);
  data.write("ftyp", 4, "ascii");
  data.write(brand, 8, "ascii");
  data.write(brand, 16, "ascii");
  return data;
}
// Synthetic small container headers; these do NOT claim to be decodable video.
const videos = new Map([
  ["video/mp4", ftyp("isom")],
  ["video/quicktime", ftyp("qt  ")],
  ["video/webm", Buffer.from("1a45dfa3874282847765626d", "hex")],
  ["video/x-matroska", Buffer.from("1a45dfa38b4282886d6174726f736b61", "hex")]
]);
for (const [mime, bytes] of videos) {
  assert.equal(validVideoSignature(mime, bytes), true, mime + " signature must be accepted");
  for (const [other, otherBytes] of videos) {
    if (other !== mime) assert.equal(validVideoSignature(mime, otherBytes), false,
      mime + " must not accept " + other + " container header");
  }
  assert.equal(validVideoSignature(mime, Buffer.from("<html><script>bad()</script></html>")), false,
    mime + " must reject HTML bytes");
  assert.equal(validVideoSignature(mime, bytes.subarray(0, 3)), false,
    mime + " must reject truncated container bytes");
}
const malformedMp4 = Buffer.from(videos.get("video/mp4"));
malformedMp4.writeUInt32BE(4096, 0);
assert.equal(validVideoSignature("video/mp4", malformedMp4), false,
  "Declared ISO BMFF ftyp box must fit within uploaded bytes");
const malformedEbml = Buffer.from(videos.get("video/webm"));
malformedEbml[4] = 0xff;
assert.equal(validVideoSignature("video/webm", malformedEbml), false,
  "Unknown-size EBML header must be rejected");
assert.equal(validVideoSignature("video/webm", Buffer.from(
  "1a45dfa3874282846e6f7065", "hex")), false,
  "EBML DocType must be exactly webm");
assert.equal(validVideoSignature("video/x-matroska", Buffer.from(
  "1a45dfa38b4282886d6174726f736b78", "hex")), false,
  "EBML DocType must be exactly matroska");
const oversizedEbml = Buffer.from("1a45dfa340102a4282847765626d", "hex");
assert.equal(validVideoSignature("video/webm", oversizedEbml), false,
  "EBML header cannot exceed the upload or bounded metadata limit");
assert.equal(validVideoSignature("video/mp4", "ftypisom"), false);
assert.equal(validVideoSignature("image/png", videos.get("video/mp4")), false);
console.log("Upload media policy: MIME-derived extensions validated image and video signatures and safe attachment fallback for active legacy filenames.");
