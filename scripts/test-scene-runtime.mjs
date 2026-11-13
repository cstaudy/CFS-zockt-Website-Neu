import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const runtime = await readFile(new URL("../assets/js/cfs-scene-runtime.js", import.meta.url), "utf8");
const html = await readFile(new URL("../widgets/scene.html", import.meta.url), "utf8");
assert.match(html, /cfs-scene-runtime\.js/);
assert.match(html, /scene-runtime\.css/);
const sceneId = "123e4567-e89b-42d3-a456-426614174112";
const widgetId = "123e4567-e89b-42d3-a456-426614174113";
function node(type = "div") {
  return {
    type, style: {}, dataset: {}, hidden: false, textContent: "",
    children: [],
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; },
    setAttribute(name, value) { this[name] = value; }
  };
}
async function render(payload, status = 200) {
  const root = node(), body = node(), urls = [];
  const document = {
    getElementById: id => id === "cfsSceneRuntime" ? root : null,
    createElement: tag => node(tag),
    body
  };
  const window = {
    innerWidth: 1280, innerHeight: 720,
    addEventListener() {}
  };
  runInNewContext(runtime, {
    document, window, location: { search: "?scene=" + sceneId },
    URLSearchParams, AbortController, setTimeout, clearTimeout, setInterval: () => {},
    JSON, Date, Number, String, Math,
    console: { error() {} },
    fetch: async (url, options) => {
      urls.push({ url, options });
      return { ok: status === 200, status, json: async () => payload };
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(urls[0].url, "/api/public/scenes/" + sceneId);
  assert.equal(urls[0].options.credentials, "omit");
  assert.equal(urls[0].options.cache, "no-store");
  return { root, body };
}
const validScene = {
  scene: { id: sceneId, profile: "landscape",
    canvas: { width: 1920, height: 1080, background: "#101820" },
    items: [{ widget_id: widgetId, x: 40, y: 50,
      width: 620, height: 132, rotation: 0, scale: 1, opacity: 1, z_index: 1 }]
  }
};
const shown = await render(validScene);
assert.equal(shown.root.children.length, 1);
assert.equal(shown.root.children[0].children[0].type, "iframe");
assert.equal(shown.root.children[0].children[0].src,
  "/widgets/output.html?widget=" + widgetId);
assert.equal(shown.root.style.background, "#101820");
const withdrawn = await render(null, 404);
assert.equal(withdrawn.root.children.length, 0,
  "Revoked scene must empty all embedded output frames");
assert.equal(withdrawn.body.children[0].hidden, false);
assert.match(withdrawn.body.children[0].textContent, /nicht veröffentlicht|nicht mehr verfügbar/);
console.log("OBS scenes: safe iframe URL, cookie-free public endpoint, revocation clears output.");
