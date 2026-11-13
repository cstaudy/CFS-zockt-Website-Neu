# Cut Studio browser integration with atomic project save

This change connects the existing Cut Studio Save action to the **already merged** atomic endpoint in #65. The browser now sends the current persisted `expected_version` together with `base_updated_at` and a complete, validated list of edited clips. Failed saves keep the in-memory editor state for correction instead of pretending to have committed.

Read-only `GET /api/creator/cut-studio/projects/:id` now includes the full owner-scoped editor metadata, a `version` field and a separate `clips` array. Older clip create/reorder/edit/delete responses return the **actual PostgreSQL** `project_version` and `project_updated_at`; the UI updates its in-memory revision after each structural operation, so a follow-up atomic Save does not fail due to a self-inflicted stale revision.

The Cut Studio project settings/create/archive handlers use a dedicated service:
- Validate input and use authenticated owner and account limits.
- Preserve the persisted timeline `clips` when saving only project settings.
- Reject stale `base_updated_at` edits, including archive attempts.
- Reject direct clip replacement through settings. Generic project endpoints may no longer create/update/archive Cut Studio objects and bypass these guards.
- All old clip mutations also lock the project, require owner, check supplied revisions when present and use a single transactional JSONB update. Untrusted clip IDs and timestamps are not accepted as authoritative; clip reorder requests must include the full matching set.

**Scope and acceptance limits:** No schema changes or new migrations; no Twitch/OBS/EventSub/Admin/MFA modifications. PostgreSQL disposable acceptance tests cover owner vs foreign edits, stale settings/archive, prevention of lost clips, old/new version tracking, invalid ranges/IDs/order and concurrent creates/saves. Static browser contract checks verify the actual Save payload and revision updates. A real desktop/Mobile-browser Cut Studio walk-through, actual Launcher export execution, and possible Render auto-deploy effects still need separate operational verification. Old third-party clients that do not provide a revision can use individual clip endpoints, but dedicated Cut Studio settings updates require the UI-provided `base_updated_at`.
