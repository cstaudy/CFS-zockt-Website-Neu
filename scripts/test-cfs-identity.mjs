import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = async path => readFile(new URL(path, root), "utf8");
const css = await read("assets/css/cfs-identity-v1.css");

for (const token of [
  "--cfs-id-ink", "--cfs-id-surface", "--cfs-id-cyan", "--cfs-id-blue",
  "--cfs-id-text", "--cfs-id-muted", "--cfs-id-warning", "--cfs-id-font-display",
  "--cfs-id-font-body", "--cfs-id-motion"
]) assert.match(css, new RegExp(token.replaceAll("-", "\\-")));
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /\.cfs-id-bottom-nav/);
assert.match(css, /focus-visible/);
assert.doesNotMatch(css, /url\([^)]*logo/i, "Identity tokens must not replace the source logo");

for (const path of [
  "index.html", "pages/dashboard.html", "pages/creator-suite.html",
  "pages/stream-studio.html", "pages/widget-studio.html"
]) {
  const html = await read(path);
  assert.match(html, /cfs-identity-v1\.css/);
  assert.match(html, /data-cfs-identity-v1="1"/);
}

console.log("CFS Identity V1 contract passed: tokens, accessibility motion guard, mobile navigation hook and pilot page wiring.");
