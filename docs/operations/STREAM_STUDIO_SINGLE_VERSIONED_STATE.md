# Stream Studio: one versioned private workspace per Creator

The existing `/api/creator/stream-studio` GET/PUT endpoints now use a dedicated, account-scoped state service. They no longer create a new generic `creator_projects` row on each save. A Creator receives one stable `config` with `version`, their own published/draft scene and widget list, and existing access-limit metadata.

- A first save sends `{expected_version:null,config:{...}}`. PostgreSQL serializes creation with an account row lock; concurrent initialization cannot create duplicate rows.
- Subsequent edits send the version returned by GET or the previous successful save. The server validates request shape and 512 KiB maximum, holds the same account lock and uses a row-version compare-and-swap. Stale and concurrent writes return HTTP 409 without silently replacing newer settings.
- The existing Stream Studio browser now loads and returns `version` on save, and preserves changes made during an in-flight save. No new data shape must be learned by the user.
- Previously saved, untyped legacy `kind='stream'` state is selected when no dedicated typed row exists; it is updated in place as `type='stream_studio'`. The original row ID is retained, not archived or deleted.
- The generic project and Stream Studio project-by-ID CRUD routes may no longer insert or change protected `stream_studio` rows. Stream Maker's `stream_maker` reserved project rules from #67 remain unaffected.

This is **not** a live stream control bridge or multi-platform streaming service. OBS/Twitch events and the Launcher remain separately controlled. No migration 026/027, schema change, admin-role or MFA alteration. Existing accounts with multiple historical untyped stream rows are not destructively deduplicated; the most recent compatible row is selected.

Acceptance requires disposable PostgreSQL HTTP tests: initial version, creator-scoped scene/widget visibility, malformed/oversized request refusal, stale and racing saves, stable row count, generic bypass denials, separate Creator accounts, and in-place legacy migration. Frontend contract tests and all isolated PostgreSQL migration/restore checks must also pass. A production backup restore and real Stream Studio/OBS device check remain separate.
