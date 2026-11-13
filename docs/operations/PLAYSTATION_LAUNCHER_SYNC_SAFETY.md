# PlayStation / Launcher sync: isolated safety release

This release extracts only the launcher-to-PlayStation synchronization hardening from draft #50 onto current main.

## Changes
- Authenticate using the configured non-empty bridge secret, compared with constant-time digest equality; active paired UUID device required.
- Validate the whole JSON payload before beginning any write: bounded profile/game/video counts, strict types, real ISO-8601 calendar dates, HTTPS-only URLs excluding literal IPs, internal DNS names, trailing-dot bypasses and embedded credentials.
- Perform all game, profile and video upserts inside one PostgreSQL transaction, locking the active device first and the owning account second. The account lock serializes concurrent syncs from different paired launchers.
- Reuse the existing row ID for repeated video URLs, reducing accidental duplication. Invalid input does not partially commit game/profile changes.
- **No automatic deletion** of existing videos for partial input or `videos: []`. A future snapshot-pruning feature needs separate explicit semantics and an acceptance test of user data retention.
- Never return account ID from the sync response.
- No database schema or migration changes, no OBS, Twitch, admin or MFA changes.

## Gates and limits
- GitHub CI must pass the extended local-only PostgreSQL HTTP tests: pairing, invalid input, same-URL replay, simultaneous devices, account isolation, revocation, retained videos.
- A CI PostgreSQL restore test does **not** prove live launcher compatibility or production backup recoverability. A real launcher/device acceptance test is still necessary before broad deployment.
- Production database reads/writes were not performed during development. Any automatic deploy behavior triggered by a GitHub merge must be considered separately.
