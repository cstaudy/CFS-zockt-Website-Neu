// Read JSON bodies even when clients use chunked transfer encoding.
export async function readJson(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), { status: 413 });
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks, size).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('INVALID_JSON'), { status: 400 });
  }
}
