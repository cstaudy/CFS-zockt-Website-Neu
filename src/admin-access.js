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

// Public/session projection only; authority comes from the current DB row.
export function accountAccessView(account) {
  if (!account) return null;
  const admin = isAdminAccount(account);
  return { ...account, role: admin ? "admin" : "creator", admin,
    email_verified: Boolean(account.email_verified_at) };
}
