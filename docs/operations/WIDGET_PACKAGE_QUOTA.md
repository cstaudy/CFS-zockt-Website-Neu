# Widget package validation and quota-safe conversion

Widget packages are private design objects in `creator_projects`. Creation validates name, world, color and output list against bounded types and a 512 KiB JSON limit. Unknown or malformed arrays are rejected rather than silently coerced.

Conversion through `POST /api/creator/shop/bundles/:id/convert` requires the requester's account to own the referenced active widget package. A widget is then created through the same `createWidget` service used by the Widget Studio, preserving plan quotas and validated initial schema. The converter no longer inserts a `creator_projects` widget directly.

A successful conversion creates a new private draft widget; it is **not** automatically published to public OBS. Provider-backed widget types remain outside the public manual/static allowlist from #60. Failed/over-limit conversions do not create a widget.

Acceptance requires local disposable PostgreSQL HTTP tests of payload limits, owner-only package visibility, malformed/foreign ID denial, permitted conversion and 402 quota denial, plus all existing isolated migration/restore CI checks. No schema migration or Admin/MFA changes.
