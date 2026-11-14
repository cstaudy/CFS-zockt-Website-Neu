# HTTP request correlation ID boundary

A caller-controlled `X-Request-ID` header is a correlation hint, **not**
trusted log text, an authentication token, or a permission grant.

The server now accepts a supplied request ID only if it:

- is a **single string**, not a list;
- contains **1–96 ASCII characters** from `[A-Za-z0-9._-]`;
- begins with an ASCII letter or digit (no leading dot/underscore/hyphen).

This preserves common UUIDs and proxy/trace correlation IDs. Empty,
overlong, whitespace-containing, path-like, control-character,
URL-looking or otherwise unsafe input is replaced with a new
cryptographically random UUIDv4. The server echoes only the validated
value in the `X-Request-ID` response header.

This does not change session identity, login, origin checks, cookies,
routing, rate limits or provider integrations. Even a valid ID is not
proof of authorization and should not be used as a secret. Operators
should avoid logging full bearer URLs or account data alongside these
correlation IDs.

The pure unit test and real HTTP integration exercise accepted,
rejected, absent and oversized values. No migrations or Render
configuration changes are needed.
