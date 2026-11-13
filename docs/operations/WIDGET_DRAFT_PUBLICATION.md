# Widget drafts and explicit publication

The Creator Widget Studio now stores editor work and public publication as distinct snapshots. A published widget's old `config` is treated as a legacy snapshot until a new draft is saved.

- **Draft edit**: `PUT /api/creator/widget-studio/widgets/:id/draft` updates the owner's editor configuration without replacing the published snapshot.
- **Explicit publish**: `POST /api/creator/widget-studio/widgets/:id/publish` promotes the current validated draft and increments the version.
- **Concurrency**: `expected_version` is checked, and the SQL UPDATE also has a version predicate to prevent concurrent overwrites.
- **Limits**: account row lock serializes simultaneous widget creation against account-plan quotas; input/shape/geometry limits reduce malformed DB records.
- **Access**: all reads/updates remain owner-bound; invalid or foreign IDs behave like not found.

This release does **not** add the anonymous public JSON output endpoint. Output URL strings already existed in the Widget Studio; they still require a separate read-only, allowlisted public projection and security tests before an OBS source is functional.

No new database migration, role change or Twitch/OBS provider connection. Unit and disposable PostgreSQL HTTP E2E checks are a release prerequisite.
