// PostgreSQL user_media.duration_ms is an int4 column. Client-provided
// duration is optional metadata, never a trusted source of playback length.
// Reject bad values before creating files or inserting records.
const INT4_MAX = 2_147_483_647;

export function parseUploadDurationMs(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^[0-9]{1,10}$/.test(value)) return undefined;
  const millis = Number(value);
  if (!Number.isSafeInteger(millis) || millis > INT4_MAX) return undefined;
  return millis === 0 ? null : millis;
}
