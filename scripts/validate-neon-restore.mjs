import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [dump, sourceHost, sourceDatabase, sourceUser, targetHost, targetDatabase, targetUser, rootCertificate] = process.argv.slice(2);

if ([dump, sourceHost, sourceDatabase, sourceUser, targetHost, targetDatabase, targetUser, rootCertificate].some((value) => !value)) {
  console.error("Aufruf: node validate-neon-restore.mjs <dump> <source-host> <source-db> <source-user> <target-host> <target-db> <target-user> <root-ca>");
  process.exit(2);
}

const source = { host: sourceHost, database: sourceDatabase, user: sourceUser };
const target = { host: targetHost, database: targetDatabase, user: targetUser };
const manifest = `${dump}.sha256`;
const singleQuote = String.fromCharCode(39);

function runTool(tool, args, { nativePasswordPrompt = false } = {}) {
  const env = { ...process.env };
  delete env.PGPASSWORD;
  env.PGSSLMODE = "verify-full";
  env.PGSSLROOTCERT = rootCertificate;
  env.PGCHANNELBINDING = "require";
  env.PGCONNECT_TIMEOUT = "10";
  for (const name of ["PGSERVICE", "PGSERVICEFILE", "PGPASSFILE", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGSSLCERT", "PGSSLKEY", "PGSSLCRL", "PGSSLCRLDIR"]) {
    delete env[name];
  }
  const toolArgs = nativePasswordPrompt ? ["--password", ...args] : args;
  const result = spawnSync(tool, toolArgs, {
    env,
    encoding: "utf8",
    stdio: nativePasswordPrompt ? ["inherit", "pipe", "inherit"] : ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.error) throw new Error(`${tool} konnte nicht gestartet werden: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${tool} Exitcode ${result.status}: ${output.trim() || "Native Fehlermeldung siehe Konsole."}`);
  return output.trim();
}

function runPsql(connection, sql) {
  return runTool("psql.exe", [
    `--host=${connection.host}`,
    "--port=5432",
    `--username=${connection.user}`,
    `--dbname=${connection.database}`,
    "--no-psqlrc",
    "--quiet",
    "--tuples-only",
    "--no-align",
    `--command=${sql}`
  ], { nativePasswordPrompt: true });
}

function lines(value) {
  return String(value || "")
    .split(String.fromCharCode(10))
    .map((item) => item.trim())
    .filter(Boolean)
    .sort();
}

function compare(name, sourceValues, targetValues) {
  if (sourceValues.length !== targetValues.length || sourceValues.some((item, index) => item !== targetValues[index])) {
    throw new Error(`${name} stimmen nicht überein: Quelle=${sourceValues.length}, Ziel=${targetValues.length}`);
  }
  console.log(`${name}=PASS count=${sourceValues.length}`);
}

function databaseInventorySql() {
  const tableWhere = `table_schema=${singleQuote}public${singleQuote} and table_type=${singleQuote}BASE TABLE${singleQuote}`;
  const sequenceSql = `insert into _restore_validation(kind, value) select ${singleQuote}sequence${singleQuote}, concat_ws(${singleQuote}|${singleQuote}, schemaname || ${singleQuote}.${singleQuote} || sequencename, coalesce(sequenceowner, ${singleQuote}<null>${singleQuote}), coalesce(data_type::text, ${singleQuote}<null>${singleQuote}), coalesce(start_value::text, ${singleQuote}<null>${singleQuote}), coalesce(min_value::text, ${singleQuote}<null>${singleQuote}), coalesce(max_value::text, ${singleQuote}<null>${singleQuote}), coalesce(increment_by::text, ${singleQuote}<null>${singleQuote}), coalesce(cycle::text, ${singleQuote}<null>${singleQuote}), coalesce(cache_size::text, ${singleQuote}<null>${singleQuote}), coalesce(last_value::text, ${singleQuote}<null>${singleQuote})) from pg_catalog.pg_sequences where schemaname=${singleQuote}public${singleQuote};`;
  const indexSql = `insert into _restore_validation(kind, value) select ${singleQuote}index${singleQuote}, concat_ws(${singleQuote}|${singleQuote}, schemaname || ${singleQuote}.${singleQuote} || tablename || ${singleQuote}.${singleQuote} || indexname, indexdef) from pg_catalog.pg_indexes where schemaname=${singleQuote}public${singleQuote};`;
  const constraintSql = `insert into _restore_validation(kind, value) select ${singleQuote}constraint${singleQuote}, concat_ws(${singleQuote}|${singleQuote}, n.nspname || ${singleQuote}.${singleQuote} || r.relname || ${singleQuote}.${singleQuote} || c.conname, c.contype::text, pg_get_constraintdef(c.oid, true), c.condeferrable::text, c.condeferred::text, c.conenforced::text, c.convalidated::text, c.connoinherit::text) from pg_catalog.pg_constraint c join pg_catalog.pg_class r on r.oid=c.conrelid join pg_catalog.pg_namespace n on n.oid=c.connamespace where n.nspname=${singleQuote}public${singleQuote};`;
  return [
    "begin;",
    "create temp table _restore_validation(kind text not null, value text not null) on commit drop;",
    `insert into _restore_validation(kind, value) select ${singleQuote}table${singleQuote}, table_name from information_schema.tables where ${tableWhere};`,
    "do $$",
    "declare table_row record;",
    "begin",
    `  for table_row in select table_name from information_schema.tables where ${tableWhere} loop`,
    "    execute format(",
    `      'insert into _restore_validation(kind, value) select %L, %L || count(*)::text || %L || encode(digest(coalesce(string_agg(to_jsonb(t)::text, chr(10) order by to_jsonb(t)::text), %L), %L), %L) from public.%I t',`,
    `      'data', table_row.table_name || '|', '|', '', 'sha256', 'hex', table_row.table_name`,
    "    );",
    "  end loop;",
    "end $$;",
    sequenceSql,
    indexSql,
    constraintSql,
    `select kind || ${singleQuote}|${singleQuote} || value from _restore_validation order by kind, value;`,
    "commit;"
  ].join("\n");
}

function parseDatabaseInventory(value) {
  const inventory = { table: [], data: [], sequence: [], index: [], constraint: [] };
  for (const record of lines(value)) {
    const separator = record.indexOf("|");
    if (separator < 0) throw new Error(`Ungültige Inventarzeile: ${record}`);
    const kind = record.slice(0, separator);
    if (!Object.hasOwn(inventory, kind)) throw new Error(`Unbekannter Inventartyp: ${kind}`);
    inventory[kind].push(record.slice(separator + 1));
  }
  return {
    tables: inventory.table,
    data: inventory.data,
    sequences: inventory.sequence,
    indexes: inventory.index,
    constraints: inventory.constraint
  };
}

function validate() {
  const dumpInfo = fs.statSync(dump);
  if (dumpInfo.size <= 0) throw new Error("Dump-Datei ist leer.");
  const actualHash = crypto.createHash("sha256").update(fs.readFileSync(dump)).digest("hex");
  const manifestText = fs.readFileSync(manifest, "utf8").trim();
  const expectedHash = manifestText.split(" ").filter(Boolean)[0]?.toLowerCase();
  if (!expectedHash || expectedHash !== actualHash || !manifestText.toLowerCase().includes(path.basename(dump).toLowerCase())) {
    throw new Error("SHA-256-Manifest stimmt nicht mit dem Dump überein.");
  }
  console.log(`archive_bytes=${dumpInfo.size}`);
  console.log(`sha256=${actualHash}`);
  console.log("manifest=PASS");

  const listing = runTool("pg_restore.exe", ["--list", "--no-owner", "--no-acl", dump]);
  console.log(`pg_restore_list=PASS toc_lines=${lines(listing).length}`);

  const tableCountSql = `select count(*) from information_schema.tables where table_schema=${singleQuote}public${singleQuote} and table_type=${singleQuote}BASE TABLE${singleQuote};`;
  const before = Number(runPsql(target, tableCountSql));
  if (before !== 0) throw new Error(`Isolierte Zieldatenbank ist nicht leer: ${before} Tabellen.`);
  console.log("target_before_tables=0");

  runTool("pg_restore.exe", [
    "--exit-on-error",
    "--single-transaction",
    "--no-owner",
    "--no-acl",
    `--host=${target.host}`,
    "--port=5432",
    `--username=${target.user}`,
    `--dbname=${target.database}`,
    dump
  ], { nativePasswordPrompt: true });

  const sourceInventory = parseDatabaseInventory(runPsql(source, databaseInventorySql()));
  const targetInventory = parseDatabaseInventory(runPsql(target, databaseInventorySql()));
  if (sourceInventory.tables.length !== 26) throw new Error(`Quelltabelleanzahl ist nicht 26: ${sourceInventory.tables.length}.`);
  if (targetInventory.tables.length !== 26) throw new Error(`Restore hat nicht 26 Tabellen erzeugt: ${targetInventory.tables.length}.`);
  console.log(`target_after_tables=${targetInventory.tables.length}`);
  compare("tables", sourceInventory.tables, targetInventory.tables);
  compare("data", sourceInventory.data, targetInventory.data);
  compare("sequences", sourceInventory.sequences, targetInventory.sequences);
  compare("indexes", sourceInventory.indexes, targetInventory.indexes);
  compare("constraints", sourceInventory.constraints, targetInventory.constraints);
  console.log(`data=PASS tables=${sourceInventory.tables.length}`);
  console.log("restore_validation=PASS");
}

try {
  validate();
} catch (error) {
  console.error(`restore_validation=FAIL ${error.message}`);
  process.exitCode = 1;
}
