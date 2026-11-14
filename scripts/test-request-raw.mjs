import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createServer, request as httpRequest } from "node:http";
import { readRaw, maxBufferedUploadBytes } from "../src/request-raw.js";

const input = chunks => Readable.from(chunks.map(value =>
  typeof value === "string" ? Buffer.from(value) : value));

assert.equal(maxBufferedUploadBytes, 16 * 1024 * 1024);
assert.deepEqual(await readRaw(input([]), 32), Buffer.alloc(0));
assert.deepEqual(await readRaw(input(["abc", "def"]), 6), Buffer.from("abcdef"));
assert.deepEqual(await readRaw(input(["a", "b", "c"]), 3), Buffer.from("abc"));
await assert.rejects(readRaw(input(["abc", "def"]), 5),
  { message: "PAYLOAD_TOO_LARGE", status: 413 });
await assert.rejects(readRaw(input([Buffer.alloc(8), Buffer.alloc(9)]), 16),
  { message: "PAYLOAD_TOO_LARGE", status: 413 });
await assert.rejects(readRaw(input(["ok"]), 0), RangeError);
await assert.rejects(readRaw(input(["ok"]), Number.POSITIVE_INFINITY), RangeError);

// Both an accurately sized and a deliberately chunked HTTP request reach the
// same bounded stream helper. No Content-Length is sent in either request.
const server = createServer(async (req, res) => {
  try {
    const bytes = await readRaw(req, 32);
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(String(bytes.length));
  } catch (error) {
    res.writeHead(error.status || 500, { "content-type": "text/plain" });
    res.end(error.message);
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const port = server.address().port;
  const sendChunked = async chunks => new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: "127.0.0.1", port, path: "/", method: "POST",
      headers: { "transfer-encoding": "chunked" }
    }, res => {
      let response = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { response += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: response }));
    });
    req.on("error", reject);
    for (const chunk of chunks) req.write(chunk);
    req.end();
  });
  assert.deepEqual(await sendChunked(["small", "-", "bytes"]),
    { status: 200, body: "11" });
  assert.deepEqual(await sendChunked([Buffer.alloc(20), Buffer.alloc(13)]),
    { status: 413, body: "PAYLOAD_TOO_LARGE" },
    "Chunked HTTP uploads must be rejected immediately on crossing their byte cap");
} finally {
  await new Promise(resolve => server.close(resolve));
}
console.log("Raw body boundary: exact size, chunked 413, no Content-Length bypass, one bounded upload cap.");
