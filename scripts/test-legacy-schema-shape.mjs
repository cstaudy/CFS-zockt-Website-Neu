import assert from "node:assert/strict";
import { expectedLegacySchema, inspectLegacySchemaShape, parseLegacySchemaSql,
  assertHistoricalBaselineShape } from "../src/legacy-schema-shape.js";

const expected = await expectedLegacySchema();
assert.equal(expected.size, 26);
assert.equal(expected.get("accounts").size, 9);
assert.equal(expected.get("accounts").get("plan").type, "text");
assert.equal(expected.get("creator_projects").get("version").type, "int4");
assert.equal(expected.get("creator_projects").get("version").not_null, true);
assert.equal(expected.get("launcher_devices").get("obs_connected").type, "bool");
assert.equal(expected.get("launcher_devices").get("obs_version").type, "text");
assert.equal(expected.get("account_mfa").get("enabled").type, "bool");
assert.equal(expected.has("mfa_login_challenges"), false, "Do not conflate 022+ with historical baseline");

const rows = [...expected].flatMap(([table, columns]) =>
  [...columns.values()].map(c => ({
    table_name: table, column_name: c.name, udt_name: c.type,
    is_nullable: c.not_null ? "NO" : "YES"
  })));
function dbOf(input) {
  const executed = [];
  return {
    executed,
    async query(sql) {
      executed.push(sql);
      assert.match(sql.trim(), /^select /i);
      assert.match(sql, /information_schema\.columns/);
      return { rows: input };
    }
  };
}
const goodDb = dbOf(rows);
const exact = await inspectLegacySchemaShape(goodDb, expected);
assert.equal(exact.matched, true);
assert.equal(exact.full_equivalence_proven, false);
assert.deepEqual(exact.missing_tables, []);
assert.equal(goodDb.executed.length, 1);
assert(!goodDb.executed[0].includes("accounts.email"), "No access to application table contents");

const baselineGateDb = dbOf(rows);
assert.equal((await assertHistoricalBaselineShape(baselineGateDb, expected)).matched, true);
assert.equal(baselineGateDb.executed.length, 1, "Operator baseline gate queries only the catalog");
const invalidBaselineDb = dbOf(rows.filter(x =>
  !(x.table_name === "accounts" && x.column_name === "role")));
await assert.rejects(assertHistoricalBaselineShape(invalidBaselineDb, expected),
  error => error?.code === "LEGACY_BASELINE_SCHEMA_SHAPE_DRIFT" &&
    !String(error.message).includes("email"),
  "A missing role column must prevent the operator baseline before ledger writes");
assert.equal(invalidBaselineDb.executed.length, 1);
const wrongNullGate = dbOf(rows.map(col =>
  col.table_name === "accounts" && col.column_name === "email" ?
    { ...col, is_nullable: "YES" } : col));
await assert.rejects(assertHistoricalBaselineShape(wrongNullGate, expected),
  /LEGACY_BASELINE_SCHEMA_SHAPE_DRIFT/);

const missing = await inspectLegacySchemaShape(dbOf(rows.filter(x =>
  x.table_name !== "creator_settings")), expected);
assert(!missing.matched);
assert.deepEqual(missing.missing_tables, ["creator_settings"]);

const extra = await inspectLegacySchemaShape(dbOf([...rows, {
  table_name: "manual_table", column_name: "example", udt_name: "text", is_nullable: "YES"
}]), expected);
assert(!extra.matched);
assert.deepEqual(extra.unexpected_tables, ["manual_table"]);
const changed = await inspectLegacySchemaShape(dbOf(rows.map(x =>
  x.table_name === "tool_jobs" && x.column_name === "status" ?
    { ...x, udt_name: "int4" } : x)), expected);
assert(changed.incompatible_columns.includes("tool_jobs.status"));
const nullable = await inspectLegacySchemaShape(dbOf(rows.map(x =>
  x.table_name === "accounts" && x.column_name === "email" ?
    { ...x, is_nullable: "YES" } : x)), expected);
assert(nullable.incompatible_columns.includes("accounts.email"));
const unexpected = await inspectLegacySchemaShape(dbOf([...rows, {
  table_name: "accounts", column_name: "bad_column", udt_name: "text", is_nullable: "YES"
}]), expected);
assert(unexpected.unexpected_columns.includes("accounts.bad_column"));
await assert.rejects(inspectLegacySchemaShape(dbOf(null), expected),
  /LEGACY_SCHEMA_CATALOG_UNAVAILABLE/);
await assert.rejects(inspectLegacySchemaShape(dbOf([...rows, rows[0]]), expected),
  /LEGACY_SCHEMA_CATALOG_DUPLICATE/);
await assert.rejects(inspectLegacySchemaShape(dbOf([{table_name:"accounts",column_name:"id",
  udt_name:"uuid",is_nullable:"maybe"}]), expected), /LEGACY_SCHEMA_CATALOG_INVALID/);
assert.throws(() => parseLegacySchemaSql(["alter table unknown add column id uuid;"]),
  /LEGACY_SCHEMA_UNKNOWN_ALTER_TABLE/);
assert.throws(() => parseLegacySchemaSql(["create table example (id money);"]),
  /LEGACY_SCHEMA_COLUMN_PARSE_FAILED/);
console.log("Historical 001–021 schema shape: 26 canonical tables, types and nullability, added columns, drift blockers and SELECT-only safety passed.");
