import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("migration runner is atomic and serialized", async () => {
  const source = await readFile(new URL("./migrate.js", import.meta.url), "utf8");
  assert.match(source, /await client\.query\("BEGIN"\)/);
  assert.match(source, /pg_advisory_xact_lock\(hashtext\('cfs-zockt:migrations'\)\)/);
  assert.match(source, /await client\.query\("COMMIT"\)/);
  assert.match(source, /await client\.query\("ROLLBACK"\)/);
  assert.match(source, /client\.release\(\)/);
});
