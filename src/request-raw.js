// Buffered binary request bodies are subject to the SAME limit with and
// without Content-Length. Counting only after Buffer.concat would allow a
// chunked client to allocate substantially more memory before rejection.
export const maxBufferedUploadBytes = 16 * 1024 * 1024;

export async function readRaw(req, maxBytes = maxBufferedUploadBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("INVALID_RAW_BODY_LIMIT");
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) {
      throw Object.assign(new Error("PAYLOAD_TOO_LARGE"), { status: 413 });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes);
}
