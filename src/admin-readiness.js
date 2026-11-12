import { ADMIN_EMAIL } from "./admin-access.js";

// A strictly read-only diagnostic. Does not return email, account id, hashes,
// secrets or any account row; never grants or changes privileges.
export async function adminReadiness(client) {
  const result = await client.query(
    `select count(*)::int as matches,
            coalesce(bool_and(role = 'admin'),false) as role_ready,
            coalesce(bool_and(email_verified_at is not null),false) as email_ready
       from accounts
      where lower(email) = $1`,
    [ADMIN_EMAIL]
  );
  const row = result.rows?.[0];
  if (!row || !Number.isInteger(row.matches) || typeof row.role_ready !== "boolean" ||
      typeof row.email_ready !== "boolean") {
    throw new Error("ADMIN_PREFLIGHT_UNAVAILABLE");
  }
  return {
    account_exists: row.matches === 1,
    role_ready: row.matches === 1 && row.role_ready,
    email_ready: row.matches === 1 && row.email_ready,
    ready: row.matches === 1 && row.role_ready && row.email_ready
  };
}
