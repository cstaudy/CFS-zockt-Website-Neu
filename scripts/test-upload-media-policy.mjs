import assert from "node:assert/strict";
import { uploadStorageExtension, uploadDeliveryHeaders } from "../src/upload-media-policy.js";

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
console.log("Upload media policy: MIME-derived extensions and safe attachment fallback for active legacy filenames.");
