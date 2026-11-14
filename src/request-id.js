import { randomUUID } from "node:crypto";

// Request IDs are correlation hints, not trusted text. Never reflect paths,
// emails, delimiters, control characters or unbounded values from clients.
// Keep common UUID, W3C trace and proxy-generated IDs compatible.
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;

export function requestId(req) {
  const supplied = req?.headers?.["x-request-id"];
  return typeof supplied === "string" && REQUEST_ID.test(supplied)
    ? supplied : randomUUID();
}
