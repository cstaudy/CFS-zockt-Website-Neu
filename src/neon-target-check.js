const neonHost = /^ep-[a-z0-9-]+(?:\.[a-z0-9-]+)+\.neon\.tech$/;
const databaseName = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,62}$/;
const allowedParameters = new Set(["sslmode", "channel_binding", "application_name"]);

function fail(code) {
  return { ok: false, code };
}

export function inspectNeonTarget(env = {}) {
  const expectedHost = String(env.EXPECTED_NEON_HOST || env.NEON_PRODUCTION_HOST || "").trim().toLowerCase();
  const expectedDatabase = String(env.EXPECTED_NEON_DATABASE || env.NEON_PRODUCTION_DATABASE || "").trim();
  if (!neonHost.test(expectedHost) || !databaseName.test(expectedDatabase)) {
    return fail("NEON_TARGET_EXPECTATION_INVALID");
  }
  if (!env.DATABASE_URL) return fail("NEON_DATABASE_URL_MISSING");
  if (String(env.DATABASE_SSL || "").toLowerCase() === "false") return fail("NEON_TLS_DISABLED");

  let url;
  try { url = new URL(env.DATABASE_URL); } catch { return fail("NEON_DATABASE_URL_INVALID"); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash) return fail("NEON_DATABASE_URL_INVALID");
  if (url.hostname.toLowerCase() !== expectedHost) return fail("NEON_TARGET_HOST_MISMATCH");
  if (decodeURIComponent(url.pathname.replace(/^\//, "")) !== expectedDatabase) return fail("NEON_TARGET_DATABASE_MISMATCH");

  const seen = new Set();
  for (const [key] of url.searchParams) {
    if (!allowedParameters.has(key) || seen.has(key)) return fail("NEON_DATABASE_URL_PARAMETERS_INVALID");
    seen.add(key);
  }
  if (url.searchParams.get("sslmode") !== "verify-full") return fail("NEON_TLS_VERIFY_FULL_REQUIRED");
  return { ok: true, code: "NEON_TARGET_VERIFIED", hostname: expectedHost, database: expectedDatabase };
}
