#!/usr/bin/env python3
"""Fail-closed static guard for the CFS production backup DRAFT.

This intentionally prevents accidental activation; a separately reviewed
change to this guard is required before a real export can ever be enabled.
No secrets or network connections are needed.
"""
from pathlib import Path
import re

path = Path(".github/workflows/production-pg18-encrypted-export-DISABLED.yml")
source = path.read_text()
checks = {
    "production workflow is hard disabled": bool(re.search(r"(?m)^\s+if:\s*\$\{\{\s*false\s*\}\}\s*$", source)),
    "manual dispatch exists": bool(re.search(r"(?m)^\s+workflow_dispatch:\s*$", source)),
    "no pull request trigger": not bool(re.search(r"(?m)^\s+(pull_request|push|schedule|workflow_run|repository_dispatch):\s*$", source)),
    "protected environment specified": "environment: cfs-backup-protected" in source,
    "contents read-only": bool(re.search(r"(?m)^\s+contents:\s*read\s*$", source)),
    "no permission write": not bool(re.search(r"(?m)^\s+\w[\w-]*:\s*write\s*$", source)),
    "TLS hostname verification": "PGSSLMODE: verify-full" in source,
    "system certificate verification": "PGSSLROOTCERT: system" in source,
    "no TLS downgrade": "sslmode=require" not in source.lower() and "sslmode=disable" not in source.lower(),
    "no source restore or migration commands": not bool(re.search(r"(?m)^\s*(?:pg_restore(?!\s+--list)|psql|npm\s+start|node\s+scripts/migrate)", source)),
    "encrypted artifact only": "encrypted-output/cfs-pg18.enc" in source and "retention-days: 1" in source,
    "separate environment secrets": all(f"secrets.{s}" in source for s in (
        "CFS_BACKUP_PGHOST", "CFS_BACKUP_PGPORT", "CFS_BACKUP_PGDATABASE",
        "CFS_BACKUP_PGUSER", "CFS_BACKUP_PGPASSWORD",
        "CFS_BACKUP_ENCRYPTION_KEY")),
}
for name, passed in checks.items():
    print(("PASS" if passed else "FAIL") + ": " + name)
if not all(checks.values()):
    raise SystemExit("Production draft safety guard failed")
print("PASS: production export is still hard-disabled; STATIC checks only")
