import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pages = [join(root, 'index.html'), ...['pages', 'widgets'].flatMap(dir => readdirSync(join(root, dir)).filter(name => name.endsWith('.html')).map(name => join(root, dir, name)))];
const missing = [];
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const match of html.matchAll(/(?:src|href)=["'](\/[^/"'?#][^"'?#]*)(?:[?#][^"']*)?["']/g)) {
    const path = match[1] === '/' ? '/index.html' : match[1];
    if (path.startsWith('/api/')) continue;
    if (!existsSync(join(root, path.slice(1)))) missing.push(`${page.slice(root.length + 1)}: ${path}`);
  }
}
console.log(`Checked ${pages.length} HTML pages; ${missing.length} missing local assets.`);
for (const item of missing) console.log(item);
if (missing.length) process.exitCode = 1;
