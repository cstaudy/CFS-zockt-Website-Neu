import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dirs = ['pages', 'widgets', 'games', 'auth'];
const pages = ['index.html'];
for (const dir of dirs) {
  for (const name of await readdir(join(root, dir))) {
    if (name.endsWith('.html')) pages.push(`${dir}/${name}`);
  }
}
pages.sort();

function auditHtml(html) {
  // Page-level static checks; runtime-generated DOM remains a separate browser test.
  // Ignore comments so snippets in historical notes do not create false positives.
  const source = html.replace(/<!--[\s\S]*?-->/g, '');
  const ids = [...source.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  const anchors = [...source.matchAll(/\bhref\s*=\s*["']#([^"']+)["']/gi)].map(m => m[1]);
  const unique = new Set();
  const duplicates = new Set();
  for (const id of ids) {
    if (unique.has(id)) duplicates.add(id);
    unique.add(id);
  }
  const missing = new Set(anchors.filter(anchor => !unique.has(anchor)));
  return { duplicates: [...duplicates], missing: [...missing], idCount: ids.length, anchorCount: anchors.length };
}

assert.deepEqual(auditHtml('<div id="one"></div><span id="one"></span>').duplicates, ['one']);
assert.deepEqual(auditHtml('<a href="#missing">Test</a>').missing, ['missing']);
assert.deepEqual(auditHtml('<a href="#valid">Test</a><section id="valid"></section>').missing, []);
assert.deepEqual(auditHtml('<!-- <p id="old"></p> --><p id="old"></p>').duplicates, []);

const problems = [];
let totalIds = 0;
let totalAnchors = 0;
for (const page of pages) {
  const html = await readFile(join(root, page), 'utf8');
  const { duplicates, missing, idCount, anchorCount } = auditHtml(html);
  totalIds += idCount;
  totalAnchors += anchorCount;
  for (const id of duplicates) problems.push(`${page}: duplicate HTML ID #${id}`);
  for (const id of missing) problems.push(`${page}: broken same-page anchor #${id}`);
}
assert(pages.length >= 50, `Unexpectedly few HTML pages: ${pages.length}`);
assert.equal(problems.length, 0, `HTML identity/anchor validation failed:\n${problems.join('\n')}`);
console.log(`HTML integrity: ${pages.length} pages, ${totalIds} IDs and ${totalAnchors} local anchors checked; no duplicates or broken same-page links.`);
