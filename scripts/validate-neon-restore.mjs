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
const doubleQuote = String.fromCharCode(34);

function runTool(tool, args, password) {
  const env = { ...process.env };
  env.PGPASSWORD = password || "";
  env.PGSSLMODE = "verify-full";
  env.PGSSLROOTCERT = rootCertificate;
  env.PGCHANNELBINDING = "require";
  env.PGCONNECT_TIMEOUT = "10";
  for (const name of ["PGSERVICE", "PGSERVICEFILE", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGSSLCERT", "PGSSLKEY", "PGSSLCRL", "PGSSLCRLDIR"]) {
    delete env[name];
  }
  const result = spawnSync(tool, args, { env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.error) throw new Error(`${tool} konnte nicht gestartet werden: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${tool} Exitcode ${result.status}: ${output.trim()}`);
  return output.trim();
}

function runPsql(connection, password, sql) {
  return runTool("psql.exe", [
    `--host=${connection.host}`,
    "--port=5432",
    `--username=${connection.user}`,
    `--dbname=${connection.database}`,
    "--no-password",
    "--no-psqlrc",
    "--tuples-only",
    "--no-align",
    `--command=${sql}`
  ], password);
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

function tableFingerprint(connection, password, table) {
  const identifier = doubleQuote + table.split(doubleQuote).join(doubleQuote + doubleQuote) + doubleQuote;
  const sql = `select count(*)::text || ${singleQuote}|${singleQuote} || encode(digest(coalesce(string_agg(to_jsonb(t)::text, E${singleQuote}\\n${singleQuote} order by to_jsonb(t)::text), ${singleQuote}${singleQuote}), ${singleQuote}sha256${singleQuote}), ${singleQuote}hex${singleQuote}) from public.${identifier} t;`;
  return runPsql(connection, password, sql).trim();
}

function schemaObjects(connection, password) {
  const sequenceSql = `select concat_ws(${singleQuote}|${singleQuote}, ${singleQuote}sequence${singleQuote}, schemaname || ${singleQuote}.${singleQuote} || sequencename, coalesce(sequenceowner, ${singleQuote}<null>${singleQuote}), coalesce(data_type::text, ${singleQuote}<null>${singleQuote}), coalesce(start_value::text, ${singleQuote}<null>${singleQuote}), coalesce(min_value::text, ${singleQuote}<null>${singleQuote}), coalesce(max_value::text, ${singleQuote}<null>${singleQuote}), coalesce(increment_by::text, ${singleQuote}<null>${singleQuote}), coalesce(cycle::text, ${singleQuote}<null>${singleQuote}), coalesce(cache_size::text, ${singleQuote}<null>${singleQuote}), coalesce(last_value::text, ${singleQuote}<null>${singleQuote})) from pg_catalog.pg_sequences where schemaname=${singleQuote}public${singleQuote} order by schemaname, sequencename;`;
  const indexSql = `select concat_ws(${singleQuote}|${singleQuote}, ${singleQuote}index${singleQuote}, schemaname || ${singleQuote}.${singleQuote} || tablename || ${singleQuote}.${singleQuote} || indexname, indexdef) from pg_catalog.pg_indexes where schemaname=${singleQuote}public${singleQuote} order by schemaname, tablename, indexname;`;
  const constraintSql = `select concat_ws(${singleQuote}|${singleQuote}, ${singleQuote}constraint${singleQuote}, n.nspname || ${singleQuote}.${singleQuote} || r.relname || ${singleQuote}.${singleQuote} || c.conname, c.contype::text, pg_get_constraintdef(c.oid, true), c.condeferrable::text, c.condeferred::text, c.conenforced::text, c.convalidated::text, c.connoinherit::text) from pg_catalog.pg_constraint c join pg_catalog.pg_class r on r.oid=c.conrelid join pg_catalog.pg_namespace n on n.oid=c.connamespace where n.nspname=${singleQuote}public${singleQuote} order by n.nspname, r.relname, c.conname;`;
  return {
    sequences: lines(runPsql(connection, password, sequenceSql)),
    indexes: lines(runPsql(connection, password, indexSql)),
    constraints: lines(runPsql(connection, password, constraintSql))
  };
}

function validate(sourcePassword, targetPassword) {
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

  const listing = runTool("pg_restore.exe", ["--list", "--no-owner", "--no-acl", dump], "");
  console.log(`pg_restore_list=PASS toc_lines=${lines(listing).length}`);

  const tableCountSql = `select count(*) from information_schema.tables where table_schema=${singleQuote}public${singleQuote} and table_type=${singleQuote}BASE TABLE${singleQuote};`;
  const before = Number(runPsql(target, targetPassword, tableCountSql));
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
    "--no-password",
    dump
  ], targetPassword);

  const after = Number(runPsql(target, targetPassword, tableCountSql));
  if (after !== 26) throw new Error(`Restore hat nicht 26 Tabellen erzeugt: ${after}.`);
  console.log(`target_after_tables=${after}`);

  const tableSql = `select table_name from information_schema.tables where table_schema=${singleQuote}public${singleQuote} and table_type=${singleQuote}BASE TABLE${singleQuote} order by table_name;`;
  const sourceTables = lines(runPsql(source, sourcePassword, tableSql));
  const targetTables = lines(runPsql(target, targetPassword, tableSql));
  compare("tables", sourceTables, targetTables);
  if (sourceTables.length !== 26) throw new Error(`Quelltabelleanzahl ist nicht 26: ${sourceTables.length}.`);

  for (const table of sourceTables) {
    const sourceFingerprint = tableFingerprint(source, sourcePassword, table);
    const targetFingerprint = tableFingerprint(target, targetPassword, table);
    if (sourceFingerprint !== targetFingerprint) throw new Error(`Datenvergleich fehlgeschlagen: ${table}.`);
  }
  console.log(`data=PASS tables=${sourceTables.length}`);

  const sourceObjects = schemaObjects(source, sourcePassword);
  const targetObjects = schemaObjects(target, targetPassword);
  compare("sequences", sourceObjects.sequences, targetObjects.sequences);
  compare("indexes", sourceObjects.indexes, targetObjects.indexes);
  compare("constraints", sourceObjects.constraints, targetObjects.constraints);
  console.log("restore_validation=PASS");
}

let input = "";
let passwordLines = 0;
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdout.write("Quellpasswort: ");
}
process.stdin.setEncoding("utf8");
process.stdin.resume();
process.stdin.on("data", (chunk) => {
  input += chunk;
  const values = input.replaceAll(String.fromCharCode(13), "").split(String.fromCharCode(10));
  if (process.stdin.isTTY && passwordLines === 0 && values.length >= 2) {
    passwordLines = 1;
    process.stdout.write("\nZielpasswort: ");
  }
  if (values.length >= 3) {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    if (process.stdin.isTTY) process.stdout.write("\n");
    process.stdin.pause();
    try {
      validate(values[0], values[1]);
    } catch (error) {
      console.error(`restore_validation=FAIL ${error.message}`);
      process.exitCode = 1;
    }
  }
});
