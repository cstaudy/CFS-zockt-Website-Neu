// Configuration check only: never connect, log URLs, or expose credentials.
const neonHost = /^ep-[a-z0-9-]+(?:\.[a-z0-9-]+)+\.neon\.tech$/;
const dbName = /^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,62}$/;
const allowedParameters = new Set(["sslmode", "channel_binding", "application_name"]);
const fail = code => ({ ok: false, code });

export function inspectNeonTarget(env = {}) {
  const host = env.CFS_EXPECTED_NEON_HOST;
  const database = env.CFS_EXPECTED_NEON_DATABASE;
  if (typeof host !== "string" || !neonHost.test(host) ||
      typeof database !== "string" || !dbName.test(database))
    return fail("NEON_EXPECTED_TARGET_REQUIRED");
  if (typeof env.DATABASE_URL !== "string" || !env.DATABASE_URL)
    return fail("NEON_DATABASE_URL_REQUIRED");
  let url, decodedDatabase;
  try {
    url = new URL(env.DATABASE_URL);
    decodedDatabase = decodeURIComponent(url.pathname.slice(1));
  } catch { return fail("NEON_DATABASE_URL_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hash ||
      !url.username || (url.port && url.port !== "5432"))
    return fail("NEON_DATABASE_URL_INVALID");
  const seen = new Set();
  for (const key of url.searchParams.keys()) {
    if (!allowedParameters.has(key) || seen.has(key))
      return fail("NEON_DATABASE_URL_AMBIGUOUS_PARAMETERS");
    seen.add(key);
  }
  if (url.hostname !== host || decodedDatabase !== database)
    return fail("NEON_TARGET_MISMATCH");
  if (env.DATABASE_SSL === "false" || url.searchParams.get("sslmode") !== "verify-full")
    return fail("NEON_TLS_VERIFY_FULL_REQUIRED");
  return { ok: true, code: "NEON_CONFIGURED_TARGET_MATCH", tls_policy_requested: "verify-full" };
}
