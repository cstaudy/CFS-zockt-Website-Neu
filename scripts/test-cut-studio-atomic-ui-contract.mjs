import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ui = await readFile(new URL("../assets/js/cut-studio.js", import.meta.url), "utf8");
const api = await readFile(new URL("../src/tool-projects.js", import.meta.url), "utf8");
const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
const projects = await readFile(new URL("../src/projects.js", import.meta.url), "utf8");

assert.match(ui, /async function saveAllCutChanges/);
assert.match(ui, /expected_version:state\.project\.version,base_updated_at:state\.project\.updated_at/,
  "Main Save action must submit both server revision fields");
assert.match(ui, /readVisibleClips\(\)/,
  "Main Save action must collect visible clip rows, not only project settings");
assert.match(ui, /method:"PUT",body:JSON\.stringify\(\{project,clips\}\)/,
  "Project and clips must be sent in one atomic PUT");
const updates = ui.match(/if\(Number\.isSafeInteger\(d\.project_version\)\)state\.project\.version=d\.project_version;/g) || [];
assert.equal(updates.length, 3,
  "Create, reorder and delete actions must update the editor project version");
assert.match(api, /\.\.\.data,id:row\.id,title:row\.name/,
  "Cut Studio must receive its editor fields at the top level");
assert.match(api, /kind==="cut"\?\{clips:Array\.isArray/,
  "Cut Studio project GET must return the timeline clips separately");
assert.match(api, /project_version: updated\.rows\[0\]\.version/,
  "Legacy clip mutations must return actual PostgreSQL revision");
assert.match(api, /for update/,
  "Clip changes must serialize project rows against concurrent updates");
assert.match(server, /saveCutProject\(req,id,await readJson\(req\)\)/);
assert.match(server, /archiveCutProject\(req,id,await readJson\(req\)\)/);
assert.match(server, /deleteClip\(req,projectId,clipId,await readJson\(req\)\)/);
assert.match(projects, /kind === "cut"\) return \{ error: "USE_CUT_STUDIO_API"/,
  "Generic project create must not bypass the dedicated Cut editor");
assert.match(projects, /and kind <> 'cut'/,
  "Generic project update must not overwrite Cut timeline data");
console.log("Cut Studio UI contract checks passed: atomic revision, clip sync and dedicated CRUD.");
