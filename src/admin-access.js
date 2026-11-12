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
