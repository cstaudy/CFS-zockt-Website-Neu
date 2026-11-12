import assert from "node:assert/strict";
import { publicWidgetPayload } from "../src/widget-output.js";

const id = "123e4567-e89b-42d3-a456-426614174000";
const row = {
  id, status: "published",
  data: {
    secret: "PRIVATE", config: { elements: [{ id: "draft", type: "text" }] },
    draft_config: { elements: [{ id: "draft", type: "text" }] },
    published_config: {
      canvas: { width: 620, height: 132 },
      settings: { manualValue: 7, apiToken: "PRIVATE" },
      elements: [{ id: "live", type: "text", data: { text: "LIVE" } }]
    }
  }
};
assert.equal(publicWidgetPayload({ ...row, status: "draft" }), null);
const payload = publicWidgetPayload(row);
assert.equal(payload.widget.config.elements[0].id, "live");
assert.equal(payload.widget.config.settings.manualValue, 7);
assert.equal(payload.widget.config.settings.apiToken, undefined);
assert.ok(!JSON.stringify(payload).includes("PRIVATE"));
assert.ok(!JSON.stringify(payload).includes("draft"));
const malicious = publicWidgetPayload({ ...row, data: { published_config: { elements: [
  { id: "x", type: "text", data: { text: "safe", secret: "PRIVATE" }, style: { color: "red;position:fixed", backgroundColor: "url(https://evil.invalid)" } },
  { id: "remote", type: "image", data: { src: "https://evil.invalid/pixel" } }
] } } });
assert.equal(malicious.widget.config.elements.length, 1);
assert.equal(malicious.widget.config.elements[0].style.color, "transparent");
assert.ok(!JSON.stringify(malicious).includes("evil.invalid"));
assert.ok(!JSON.stringify(malicious).includes("PRIVATE"));
console.log("Public widget projection tests passed.");
