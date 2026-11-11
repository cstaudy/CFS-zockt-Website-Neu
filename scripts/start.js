if (process.env.DATABASE_URL) {
  await import("./migrate.js");
}
await import("../server.js");
