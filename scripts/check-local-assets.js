import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pages = [join(root, 'index.html'), ...readdirSync(join(root, 'pages')).filter(name => name.endsWith('.html')).map(name => join(root, 'pages', name))];
const missing = [];
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const match of html.matchAll(/(?:src|href)=["'](\/assets\/(?:css|js|img)\/[^"'?#]+)(?:[?#][^"']*)?["']/g)) {
    if (!existsSync(join(root, match[1].slice(1)))) missing.push(`${page.slice(root.length + 1)}: ${match[1]}`);
  }
}
console.log(`Checked ${pages.length} HTML pages; ${missing.length} missing local assets.`);
for (const item of missing) console.log(item);
if (missing.length) process.exitCode = 1;
