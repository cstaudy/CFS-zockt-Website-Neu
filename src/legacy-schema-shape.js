import { legacyBaselineFiles } from "./legacy-baseline-files.js";
import { loadMigrationSql } from "./migrations.js";

// Reads only deterministic migration source text and PostgreSQL system catalog
// metadata. It does not read rows from any application table.
const TYPES = Object.freeze({
  uuid: "uuid", text: "text", jsonb: "jsonb", timestamptz: "timestamptz",
  bigint: "int8", bigserial: "int8", integer: "int4", boolean: "bool"
});
const namePattern = /^[a-z][a-z0-9_]*$/;
const tablePattern = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z][a-z0-9_]*)\s*\(/gi;
const addColumnPattern = /\balter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z][a-z0-9_]*)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z][a-z0-9_]*)\s+(uuid|text|jsonb|timestamptz|bigint|bigserial|integer|boolean)\b([^;]*)/gi;

function separateColumns(sql, firstParen) {
  const segments = [];
  let level = 0, start = firstParen + 1, quote = "";
  for (let i = firstParen; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      if (ch === quote) {
        if (sql[i + 1] === quote) { i++; continue; }
        quote = "";
      }
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === "(") { level++; continue; }
    if (ch === ")") {
      level--;
      if (level === 0) {
        segments.push(sql.slice(start, i).trim());
        return segments;
      }
      if (level < 0) break;
    }
    if (ch === "," && level === 1) {
      segments.push(sql.slice(start, i).trim());
      start = i + 1;
    }
  }
  throw new Error("LEGACY_SCHEMA_SQL_TABLE_PARSE_FAILED");
}

function columnFromSegment(segment) {
  if (/^(?:constraint|unique|primary|foreign|check)\b/i.test(segment)) return null;
  const match = /^([a-z][a-z0-9_]*)\s+(uuid|text|jsonb|timestamptz|bigint|bigserial|integer|boolean)\b/i.exec(segment);
  if (!match || !namePattern.test(match[1])) throw new Error("LEGACY_SCHEMA_COLUMN_PARSE_FAILED");
  return { name: match[1].toLowerCase(), type: TYPES[match[2].toLowerCase()],
    not_null: /\bnot\s+null\b|\bprimary\s+key\b/i.test(segment) };
}

export function parseLegacySchemaSql(sqlFiles) {
  const expected = new Map();
  for (const source of sqlFiles) {
    if (typeof source !== "string") throw new Error("LEGACY_SCHEMA_SQL_MISSING");
    for (const match of source.matchAll(tablePattern)) {
      const table = match[1].toLowerCase();
      if (expected.has(table)) throw new Error("LEGACY_SCHEMA_DUPLICATE_TABLE");
      const columns = new Map();
      for (const segment of separateColumns(source, match.index + match[0].length - 1)) {
        const col = columnFromSegment(segment);
        if (!col) continue;
        if (columns.has(col.name)) throw new Error("LEGACY_SCHEMA_DUPLICATE_COLUMN");
        columns.set(col.name, col);
      }
      if (!columns.size) throw new Error("LEGACY_SCHEMA_TABLE_WITHOUT_COLUMNS");
      expected.set(table, columns);
    }
    for (const match of source.matchAll(addColumnPattern)) {
      const table = match[1].toLowerCase(), column = match[2].toLowerCase();
      const columns = expected.get(table);
      if (!columns) throw new Error("LEGACY_SCHEMA_UNKNOWN_ALTER_TABLE");
      const col = columnFromSegment(column + " " + match[3] + " " + match[4]);
      if (columns.has(column)) {
        const prev = columns.get(column);
        // 004 repeats an already declared plan column, harmless only if
        // its type and nullability agree with the original definition.
        if (prev.type !== col.type || prev.not_null !== col.not_null)
          throw new Error("LEGACY_SCHEMA_CONFLICTING_ALTER");
      } else columns.set(column, col);
    }
  }
  // This stable 001–021 baseline is reviewed separately from 022+ MFA.
  if (expected.size !== 26) throw new Error("LEGACY_SCHEMA_UNEXPECTED_TABLE_COUNT");
  return expected;
}

export async function expectedLegacySchema() {
  const sql = await Promise.all(legacyBaselineFiles.map(loadMigrationSql));
  return parseLegacySchemaSql(sql);
}

export async function inspectLegacySchemaShape(db, expected = null) {
  if (!expected) expected = await expectedLegacySchema();
  const result = await db.query(`
    select table_name, column_name, udt_name, is_nullable
    from information_schema.columns
    where table_schema = 'public' and table_name <> 'schema_migrations'
    order by table_name, ordinal_position
  `);
  if (!Array.isArray(result?.rows)) throw new Error("LEGACY_SCHEMA_CATALOG_UNAVAILABLE");
  const actual = new Map();
  for (const row of result.rows) {
    if (!namePattern.test(String(row?.table_name)) ||
        !namePattern.test(String(row?.column_name)) ||
        typeof row?.udt_name !== "string" ||
        !["YES", "NO"].includes(row.is_nullable))
      throw new Error("LEGACY_SCHEMA_CATALOG_INVALID");
    if (!actual.has(row.table_name)) actual.set(row.table_name, new Map());
    const columns = actual.get(row.table_name);
    if (columns.has(row.column_name)) throw new Error("LEGACY_SCHEMA_CATALOG_DUPLICATE");
    columns.set(row.column_name, row);
  }
  const missingTables = [], extraTables = [], missingColumns = [], extraColumns = [], incompatibleColumns = [];
  for (const [table, columns] of expected) {
    const current = actual.get(table);
    if (!current) { missingTables.push(table); continue; }
    for (const [name, expectedCol] of columns) {
      const col = current.get(name);
      if (!col) { missingColumns.push(table + "." + name); continue; }
      if (col.udt_name !== expectedCol.type ||
          (col.is_nullable === "NO") !== expectedCol.not_null)
        incompatibleColumns.push(table + "." + name);
    }
    for (const name of current.keys()) if (!columns.has(name))
      extraColumns.push(table + "." + name);
  }
  for (const name of actual.keys()) if (!expected.has(name)) extraTables.push(name);
  const report = {
    matched: !missingTables.length && !extraTables.length && !missingColumns.length &&
      !extraColumns.length && !incompatibleColumns.length,
    expected_tables: expected.size, observed_tables: actual.size,
    missing_tables: missingTables.sort(), unexpected_tables: extraTables.sort(),
    missing_columns: missingColumns.sort(), unexpected_columns: extraColumns.sort(),
    incompatible_columns: incompatibleColumns.sort(),
    // Index/constraint definitions, data and backups are NOT proved by this
    // name/type/nullability audit; controlled clone baseline remains mandatory.
    full_equivalence_proven: false
  };
  return report;
}
