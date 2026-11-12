// Never make changes to a legacy production migration ledger just because
// an environment variable was left enabled on a web service.
if (process.env.MIGRATION_BASELINE_ON_START === "yes") {
  throw new Error("Automatic migration baselines are forbidden. Run the manual verified-backup baseline command instead.");
}
if (process.env.DATABASE_URL) await import("./migrate.js");
await import("../server.js");
