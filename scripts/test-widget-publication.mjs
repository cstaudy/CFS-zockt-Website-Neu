import assert from "node:assert/strict";
import { widgetConfigs, nextWidgetData } from "../src/widget-publication.js";

const initial = { config: { elements: [{ id: "a", text: "LIVE" }] } };
const draftEdit = nextWidgetData(initial, { config: { elements: [{ id: "a", text: "ENTWURF" }] } }, false, "published");
assert.equal(draftEdit.published_config.elements[0].text, "LIVE");
assert.equal(widgetConfigs(draftEdit, "published").draft.elements[0].text, "ENTWURF");
assert.equal(widgetConfigs(draftEdit, "published").published.elements[0].text, "LIVE");
assert.equal(widgetConfigs(draftEdit, "published").changed, true);

const republished = nextWidgetData(draftEdit, {}, true, "published");
assert.equal(republished.published_config.elements[0].text, "ENTWURF");
assert.equal(widgetConfigs(republished, "published").changed, false);
republished.draft_config.elements[0].text = "LOCAL CHANGE";
assert.equal(republished.published_config.elements[0].text, "ENTWURF");

assert.equal(widgetConfigs(initial, "draft").published, null);
assert.equal(widgetConfigs(initial, "published").published.elements[0].text, "LIVE");
console.log("Widget publication tests passed: legacy compatibility, draft isolation, republish.");
