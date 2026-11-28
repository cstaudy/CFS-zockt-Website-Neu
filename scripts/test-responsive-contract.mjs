import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const ignoredDirectories = new Set([".git", "node_modules", "_codex_sources", "codex_handover"]);

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      files.push(...await htmlFiles(join(directory, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(join(directory, entry.name));
    }
  }
  return files;
}

const files = await htmlFiles(root);
const failures = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  const name = relative(root, file).replaceAll("\\", "/");
  if (!/<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(source)) failures.push(`${name}: missing html lang`);
  if (!/<meta\b(?=[^>]*\bname\s*=\s*["']viewport["'])[^>]*>/i.test(source)) failures.push(`${name}: missing viewport`);
}

const brandCss = await readFile(join(root, "assets", "css", "cfs-brand-v198.css"), "utf8");
for (const width of [980, 760, 520]) {
  if (!new RegExp(`@media\\s*\\(\\s*max-width\\s*:\\s*${width}px`, "i").test(brandCss)) {
    failures.push(`assets/css/cfs-brand-v198.css: missing max-width ${width}px breakpoint`);
  }
}

if (failures.length) {
  console.error(`responsive_contract=FAIL failures=${failures.length}`);
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(`responsive_contract=PASS pages=${files.length} breakpoints=980,760,520`);
}
