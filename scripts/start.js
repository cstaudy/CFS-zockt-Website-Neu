if (process.env.DATABASE_URL) {
  if (process.env.MIGRATION_BASELINE_ON_START === "yes") await import("./baseline-migrations.js");
  else await import("./migrate.js");
}
await import("../server.js");
