# Proposed authenticated backup design — NOT APPROVED FOR PRODUCTION

## Current evidence
- Synthetic PostgreSQL 18 export/isolated restore test passed: https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43788807489
- Synthetic AES-256-GCM roundtrip and tamper/wrong-key rejection passed: https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43855794855
- Synthetic encrypted artifact transferred between separate GitHub Actions jobs, retrieved, authenticated and tamper-rejection checked: https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43856450742. This is NOT iCloud storage or a restored database from the transferred file.
- Website checks passed: https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43788807493
- No production export, encrypted production artifact, independent restore, deployment or Render change has occurred.
- Render Free PostgreSQL expiry: **2026-12-09 18:36 UTC**. The deadline makes an approved durable backup urgent.

## Proposed architecture (design, not executable instructions)
1. Authorized operator confirms whether production personal data may be processed on a GitHub-hosted runner; otherwise choose an approved execution environment.
2. Use PostgreSQL 18 `pg_dump -Fc` against an explicitly verified read-only/dump-capable source connection with TLS certificate verification. Record snapshot time, PostgreSQL version, source identity, table inventory and non-sensitive metadata.
3. Encrypt the dump **before any upload** using a reviewed, maintained authenticated-encryption implementation (for example, age with a vetted recipient-key workflow). Do not use unauthenticated OpenSSL CBC or an editable SHA-256 file as an authenticity guarantee. Avoid logging keys, database URLs, or plaintext.
4. Transfer **only the encrypted artifact** through an operator-approved channel to independently controlled storage (iCloud Drive is a candidate, not yet approved). GitHub Actions artifact retention alone is not a durable backup.
5. Keep the decryption identity **separate** from the backup, with tested emergency recovery. Do not store it in the same iCloud folder, GitHub repo, PR or Actions artifact.
6. On an independent isolated PostgreSQL 18 instance, retrieve the **stored copy**, authenticate/decrypt it and restore it. Verify schema, representative record counts/checksums, sequences, indexes, constraints, extensions, privileges and a read-only application smoke test. Record evidence without exposing user data.
7. Define a retention schedule, access controls, recovery owner, expiry reminders and an approved plan to migrate or upgrade the expiring Render database.

## iPhone operator checkpoints
- In **Files → Browse → iCloud Drive**, verify that the folder is accessible and not shared publicly. The operator reports **195 GB available**.
- Confirm that the encrypted file can be saved from Safari/Files and later retrieved independently; **do not upload a real dump yet**.
- Agree on a separate, recoverable key custody method. Never paste private keys or production connection strings into chat.
- Approve data processing, storage location, and test-restore handling **before** a separate production workflow is introduced.
- Review all required environment/branch restrictions and least-privilege database access.

## Release gates
- [x] Synthetic PostgreSQL 18 dump/restore test passed
- [x] Synthetic sequence and UNIQUE/CHECK constraint checks passed
- [x] AES-256-GCM authenticated encryption, wrong-key and tamper rejection tested with synthetic bytes (GitHub Actions run 43855794855); production encryption packaging and key custody remain unapproved
- [x] Encrypted synthetic file transferred and retrieved across independent GitHub Actions jobs (temporary GitHub artifact only)
- [ ] Independently controlled durable storage (e.g. approved iCloud Drive folder) and retrieval tested with synthetic encrypted file
- [ ] Full PostgreSQL restore from retrieved authenticated encrypted synthetic dump verified
- [ ] Source TLS and least-privilege access reviewed
- [ ] Real-data processing and key custody approved
- [ ] Production export authorized and completed
- [ ] Restore from independently retained encrypted production artifact verified
- [ ] Durable replacement/upgrade plan approved before database expiry
- [ ] Separate deployment authorization

**STOP: No production backup workflow, merge for production execution, database writes, or deployment is authorized by this document.**
