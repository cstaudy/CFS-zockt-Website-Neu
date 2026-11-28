// A matching email address alone must never grant privileged access.
// Admin status requires an explicitly provisioned role and proof of inbox ownership.
export const ADMIN_EMAIL = "cstaudygaming@googlemail.com";

export function isAdminEmail(value) {
  return String(value || "").trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAdminAccount(account) {
  return Boolean(
    account &&
    isAdminEmail(account.email) &&
    account.role === "admin" &&
    account.email_verified_at
  );
}

// Keep the public account projection identical across login, session restore,
// MFA completion and admin-facing endpoints. A role value alone is never an
// authorization decision and the password hash must never cross that boundary.
export function accountAccessView(account) {
  if (!account) return null;
  const { password_hash: _passwordHash, ...safe } = account;
  const admin = isAdminAccount(account);
  return {
    ...safe,
    role: admin ? "admin" : "creator",
    admin,
    email_verified: Boolean(account.email_verified_at)
  };
}
