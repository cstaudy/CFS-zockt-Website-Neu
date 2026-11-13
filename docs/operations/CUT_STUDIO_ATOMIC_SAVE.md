# Cut Studio atomic project and timeline save (additive API)

This release adds a **new, opt-in** endpoint:

`PUT /api/creator/cut-studio/projects/:id/save`

It accepts exactly one full timeline snapshot and a project object containing:
- `title` (non-empty string, maximum 160 characters)
- `expected_version` (positive integer from `GET .../projects/:id`)
- `base_updated_at` (same project's returned `updated_at`)
- optional additional project fields
- `clips`: an array containing **all** existing clips, each with its `id` and the clip's previously returned `base_updated_at`; optional edited clip fields such as `in_ms`, `out_ms` and `caption`.

The endpoint starts a PostgreSQL transaction, locks the owner-bound project, verifies **both** project version and original timestamp, checks the complete clip set and each clip's revision, validates timeline ranges, bounds the resulting record at 512 KiB, then updates project and clips in one atomic transaction. Stale snapshots return 409 without partial writes. The new endpoint never silently drops a clip because an editor sent an incomplete list.

The existing Creator cut/project/clip endpoints stay available for backwards compatibility. Their project revisions are now returned in read responses and are incremented on legacy project and clip edits, so those edits invalidate old atomic-save snapshots. **Legacy individual clip endpoints themselves still do not provide full cross-request optimistic concurrency**; migration to the atomic API should be a separately reviewed front-end task. This change does not replace the existing Cut Studio editor or start an export.

No new tables or migrations, no Provider/EventSub, MFA or Admin changes. Release gates include isolated PostgreSQL HTTP tests for owner isolation, bad input, stale project/clip versions, invalid ranges, partial snapshots, full rollback, concurrent requests and legacy edit invalidation. CI database restore tests do not prove a real production backup or in-device Cut Studio acceptance.
