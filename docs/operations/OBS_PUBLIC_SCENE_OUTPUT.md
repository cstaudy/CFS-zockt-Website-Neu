# Public OBS scenes: explicit owner and publication guarantees

A scene is published only by the authenticated creator who owns the scene and **all** referenced widgets. The creator can edit a private draft independently of the last published scene. Version checks reject concurrent/stale writes. Scene creation is quota-bound under a per-account PostgreSQL lock.

A publicly accessible `/widgets/scene.html?scene=<UUID>` source uses `GET /api/public/scenes/<UUID>`, which returns only a published scene snapshot and its allowlisted positions, dimensions and IDs. **Anyone with the scene UUID can view its intentionally published layout.** The public handler loads published widgets only from the same account, and each must also pass the manual/static safe-output allowlist from #60. Twitch, unverified providers, private drafts, archived/unpublished or foreign widgets cannot be embedded.

This is an explicit opt-in public URL, not a private project sharing API. Public JSON includes no private account IDs, widget draft contents, tokens or raw project data. A withdrawn or inaccessible widget makes the scene unavailable when no valid public widgets remain; the runtime stops and clears its frames after a permanent 404.

Release gates: full CI (scene privacy/validation, PostgreSQL owner vs foreign account, private draft isolation, publish/republish, stale version rejection, isolated migration/restore) followed by separate real OBS/Render verification. No migration 026/027, admin-role or Twitch/EventSub changes in this release.
