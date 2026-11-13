import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const ui = await readFile(new URL("../assets/js/stream-studio.js", import.meta.url), "utf8");
const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
const service = await readFile(new URL("../src/stream-studio-state.js", import.meta.url), "utf8");
assert.match(ui, /state\.version=data\.version\?\?null/,
  "Stream Studio must load the persisted revision");
assert.match(ui, /expected_version:state\.version/,
  "Stream Studio must send a compare-and-swap revision on every save");
assert.match(ui, /state\.version=data\.version/,
  "Successful save must update the browser-side revision");
assert.match(server, /getStreamStudioState\(req\)/);
assert.match(server, /saveStreamStudioState\(req,await readJson\(req\)\)/);
assert.match(service, /select id from accounts where id=\$1 for update/,
  "Creation requires an account lock to prevent duplicate Stream Studio rows");
assert.match(service, /version=version\+1/);
assert.match(service, /and version=\$4/,
  "Updates require a matching expected revision");
assert.match(service, /data->>'type'='stream_studio' or not \(data \? 'type'\)/,
  "Legacy untyped Stream Studio records must remain discoverable");
console.log("Stream Studio revision contract passed: browser, single state service and legacy fallback.");
