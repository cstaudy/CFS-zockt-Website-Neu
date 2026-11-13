import assert from "node:assert/strict";
import { validateMakerConfig } from "../src/stream-maker.js";

const valid = { name: "CI Widget", elements: [{ id: "counter_ci", template: "counter", value: 0 }] };
assert.equal(validateMakerConfig(valid).elements[0].id, "counter_ci");
assert.equal(validateMakerConfig(valid).elements[0].value, 0);
assert.equal(validateMakerConfig({ ...valid, source: "https://evil.example/private.png" }).source, "");
assert.equal(validateMakerConfig({ ...valid, source: "/assets/uploads/123e4567-e89b-42d3-a456-426614174000-ci.png" }).source,
  "/assets/uploads/123e4567-e89b-42d3-a456-426614174000-ci.png");
assert.equal(validateMakerConfig({ ...valid, source: "/assets/uploads/../../secret" }).source, "");
assert.equal(validateMakerConfig({ ...valid, elements: [{ id: "p", template: "camera" }] }).elements[0].template, "camera");
for (const invalid of [
  null, [], {}, { elements: [] },
  { ...valid, elements: Array.from({ length: 33 }, () => valid.elements[0]) },
  { ...valid, elements: [null] },
  { ...valid, elements: [{ id: "x", template: "unknown" }] },
  { ...valid, elements: [{ id: "<script>", template: "counter" }] },
  { ...valid, elements: [{ id: "x", template: "counter", runtime: [] }] },
  { ...valid, variants: [null] },
  { ...valid, variants: Array(17).fill({}) },
  { ...valid, theme: [] }
]) {
  assert.equal(validateMakerConfig(invalid), null, "Invalid source must not be saved");
}
console.log("Stream Maker validation passed: source policy, element bounds and bad-input rejection.");
