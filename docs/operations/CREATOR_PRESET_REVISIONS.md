# Creator preset validation and revision protection

Caption, export and scene presets remain private to their owning Creator account. This update enforces a bounded JSON object payload (64 KiB) and validates the kind/name/UUID before reaching PostgreSQL.

For updates, the client may supply `expected_updated_at`. PostgreSQL compares this revision with the current row and refuses stale writes (HTTP 409); the database writes a monotonically newer timestamp. Two clients using the same revision cannot silently overwrite one another. Ownership is always checked in the SQL WHERE clause.

Existing callers that do not send a revision retain their prior update behavior for compatibility, so these are *opt-in* concurrency checks until every editor sends the timestamp. No schema migration, public content exposure, account role changes or automated data deletion.

Acceptance uses local disposable PostgreSQL HTTP end-to-end tests for input shape/size, duplicate names, creator isolation, stale revision, competing edits and owner-only deletion. A CI restore simulation is not a production backup verification.
