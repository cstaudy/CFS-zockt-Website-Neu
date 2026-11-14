import assert from "node:assert/strict";
import { parseUploadDurationMs } from "../src/media-duration.js";

const good = new Map([
  [undefined, null], [null, null], ["", null], ["0", null],
  ["000", null], ["1", 1], ["001", 1], ["42000", 42000],
  ["2147483647", 2_147_483_647]
]);
for (const [header, expected] of good) {
  assert.equal(parseUploadDurationMs(header), expected,
    "Optional duration must remain nullable and bounded within PostgreSQL int4");
}
for (const header of [
  "-1", "+1", "Infinity", "NaN", "1e3", "3.5", " 42 ", "  ",
  "2147483648", "9999999999", "00000000000", "99999999999999999999",
  "3ms", "null", "true", [], ["123"], {}, 1, Number.NaN
]) {
  assert.equal(parseUploadDurationMs(header), undefined,
    "Invalid or overflow duration must not reach file storage or database: " + String(header));
}
console.log("Video duration: valid optional int4 metadata, no negative/fractional/nonfinite/overflow values.");
