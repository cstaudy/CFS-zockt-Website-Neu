// Decode a user-supplied filename without allowing malformed URL escapes to
// become an uncaught server error. Names are sanitized by the upload handlers.
export function decodeUploadFilename(value, fallback = 'upload') {
  try {
    return decodeURIComponent(String(value || fallback));
  } catch {
    return null;
  }
}
