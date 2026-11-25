import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { databasePoolOptions } from "../src/db.js";

const remote = "postgresql://test:test@db.example.com/app";
test("remote TLS is verified and URL overrides cannot weaken it", async () => {
  for (const query of ["", "?sslmode=disable", "?ssl=false", "?sslmode=no-verify&host=localhost", "?sslrootcert=bad&sslkey=bad"]) {
    const config = databasePoolOptions({ DATABASE_URL: remote + query });
    assert.deepEqual(config.ssl, { rejectUnauthorized: true });
    const client = new pg.Client(config);
    assert.equal(client.connectionParameters.host, "db.example.com");
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  }
});
test("custom CA is preserved", () => {
  assert.equal(databasePoolOptions({ DATABASE_URL: remote+"?sslmode=require", DATABASE_SSL_CA: "test-ca" }).ssl.ca, "test-ca");
});
test("plaintext is limited to local nonproduction", () => {
  assert.throws(() => databasePoolOptions({ DATABASE_URL: remote, DATABASE_SSL: "false" }));
  const local = "postgresql://test:test@localhost/app";
  assert.throws(() => databasePoolOptions({ DATABASE_URL: local, DATABASE_SSL: "false", NODE_ENV: "production" }));
  assert.equal(databasePoolOptions({ DATABASE_URL: local, DATABASE_SSL: "false", NODE_ENV: "test" }).ssl, false);
});
test("invalid URLs and SSL settings fail closed", () => {
  assert.throws(() => databasePoolOptions({ DATABASE_URL: "invalid" }));
  assert.throws(() => databasePoolOptions({ DATABASE_URL: remote, DATABASE_SSL: "invalid" }));
});
