# Security review — PR #97 (16 November 2026)

**Decision: NOT READY TO RUN OR MERGE.** This is a design review, not a backup execution record.

## Verified facts
- Repository `cstaudy/CFS-zockt-Website-Neu` is **public**, default branch `main`.
- Production PostgreSQL 18 database `cfs-zockt-db` is on Render Free; expiration is 2026-12-09 18:36 UTC.
- The current workflow is **synthetic-only** and runs on pull requests affecting the workflow or by manual dispatch. It uses no production secrets or connection strings. It must not be repurposed for production without a separate reviewed change and explicit approval.
- No production backup, decryption, or isolated restore has been executed by this PR.

## Verified synthetic test evidence
- GitHub Actions run 43784618670 passed on 2026-11-16: synthetic dump, isolated restore and record comparison. A later revision adds identity-sequence and constraint assertions; check its run separately before claiming those passed.
- This proves only the synthetic restore mechanics; it does not create an independently retained or production backup.

## Blocking security and reliability issues
1. **Real production data would enter a GitHub-hosted runner and its temporary PostgreSQL service.** Explicit authorization for this processor, retention and data protection is required. Review whether production data should be processed there at all.
2. **No independently retained backup.** Any short-lived GitHub artifact would be temporary and not sufficient for disaster recovery. Select a restricted offsite destination, retention and access policy before use.
3. **Encryption design requires hardening.** The previous production-export draft used OpenSSL `enc -aes-256-cbc` with a separate SHA-256 file; that unsafe approach has been **removed**. Any future production design must use authenticated encryption; an attacker able to change both an unauthenticated artifact and its checksum could defeat integrity verification. Select a reviewed authenticated-encryption approach and separately protected integrity/authenticity verification before handling production data.
4. **Secrets and execution access require review.** Confirm GitHub environment reviewer protections for this public repository, default-branch restrictions, least-privilege credentials, trusted workflow revision and no unintended access by collaborators.
5. **Restore check is incomplete.** A synthetic test (even with record, sequence and constraint checks) does not verify production ownership/GRANTs, indexes, extensions, full data consistency or application readiness. Require a controlled read-only application smoke test and an independent restore from the *retained encrypted copy*.
6. **External connectivity and TLS.** Validate the precise source host, certificate verification and network access without disclosing credentials. Never log or upload a database URL.
7. **Container image and action provenance.** Pin reviewed image digests and GitHub action commit SHAs before enabling production processing; test the workflow with synthetic data only first.
8. **Database migration hazard.** The production application `npm start` invokes migrations when DATABASE_URL is present. Never use it in the restore test; the backup workflow must not deploy or migrate.

## Next safe actions
- Review this PR without merging it.
- Choose and approve an external encrypted storage destination and a separate isolated restore destination.
- Replace the encryption design with reviewed authenticated encryption; validate artifact recovery from that destination.
- Set up GitHub environment controls and secrets using the GitHub UI, **never** in chat or repository files.
- Confirm synthetic-only tests (including sequence and constraint checks) pass and inspect logs for leakage before considering any production export.
- Obtain explicit authorization for processing real production data and separately for any production deployment.

Until all gates pass: **NO PRODUCTION BACKUP DISPATCH, NO RESTORE OF REAL DATA, NO RENDER CHANGES, NO DEPLOYMENT.**
