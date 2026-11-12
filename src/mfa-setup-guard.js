// Atomically prevent MFA setup from disabling an already enabled second factor.
// Replacing a pending (disabled) setup is allowed; resetting enabled MFA
// requires the existing authenticated disable flow first.
export async function savePendingMfaSetup(pool, accountId, secret) {
  const result = await pool.query(
    `insert into account_mfa(account_id,secret,enabled,recovery_codes)
     values($1,$2,false,'[]'::jsonb)
     on conflict(account_id) do update
       set secret=excluded.secret,
           enabled=false,
           recovery_codes='[]'::jsonb,
           updated_at=now()
     where account_mfa.enabled = false
     returning account_id`,
    [accountId, secret]
  );
  return result.rowCount === 1;
}
