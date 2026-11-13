# Manual/static OBS widget output – security boundary

This opt-in public output is deliberately limited to two widget types:

- `manual_counter` – values explicitly maintained by the account owner
- `obs_overlay` – static text, counters, progress indicators and shapes only

The public URL `/widgets/output.html?widget=<UUID>` fetches `GET /api/public/widgets/<UUID>` without cookies. This is intentional: OBS Browser Sources do not log into a creator session. **Anyone with the UUID can view the explicitly published projection.** Do not put secrets in content that you choose to publish.

A widget is returned only when it is a published `creator_projects` row of kind `widget` with an allowed `published_config.widgetType`. The response is a new allowlisted JSON object. It excludes private account identifiers, draft configurations, API tokens, raw project data, arbitrary remote media, chat and unverified provider events. No `twitch_live_timer`, `twitch_follow_alert`, `twitch_latest_follower` or `follower_goal` is anonymously served yet. Unsupported or missing IDs consistently return 404.

Legacy published manual/static rows with a single `config` stay accessible, but as soon as a separate draft is created, edits do not affect the published snapshot until explicit republishing. The widget browser runtime clears its frame when a previously public widget returns 404 and polls every 15 seconds. Responses are `Cache-Control: no-store`.

CI verifies projection allowlists, DOM escaping, rendering, browser polling and revocation, and PostgreSQL HTTP tests cover unauthorized access, publication, private draft revisions and unsupported providers. CI does **not** replace a real OBS Browser Source device test or review of any auto-deploy in Render. No schema migration or Admin/MFA changes occur here.
