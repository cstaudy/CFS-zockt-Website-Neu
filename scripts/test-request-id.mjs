import assert from "node:assert/strict";
import { requestId } from "../src/request-id.js";

const accepted = [
  "request-123", "0123456789abcdef", "trace.01_part-2",
  "ABC_def.123", "a", "x".repeat(96),
  "123e4567-e89b-42d3-a456-426614174112"
];
for (const candidate of accepted) {
  assert.equal(requestId({ headers: { "x-request-id": candidate } }), candidate,
    "Valid correlation IDs should remain unchanged");
}
const rejected = [
  "", " ", " token", "token ", ".hidden", "_hidden", "-hidden",
  "../secret", "alice@example.test", "a?b", "one,two", "bad:value",
  "bad#fragment", "<script>", "evil\r\ncontent-length:0", "x".repeat(97)
];
for (const candidate of rejected) {
  const generated = requestId({ headers: { "x-request-id": candidate } });
  assert.match(generated, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
  assert.notEqual(generated, candidate, "Unsafe request IDs must not be reflected");
}
for (const headers of [{}, { "x-request-id": ["multiple", "headers"] },
  { "x-request-id": 12 }, null]) {
  assert.match(requestId({ headers }), /^[a-f0-9-]{36}$/i);
}
assert.match(requestId(null), /^[a-f0-9-]{36}$/i);
assert.notEqual(requestId(null), requestId(null),
  "Request IDs must use fresh nonpredictable identifiers");
console.log("HTTP request ID: valid correlation preserved, unsafe/unbounded values rejected, unique UUID fallback.");
