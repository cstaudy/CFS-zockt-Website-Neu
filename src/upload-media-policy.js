import { extname } from "node:path";

// An upload's original filename is display metadata, never a MIME authority.
// The server currently serves static bytes based on the storage extension.
const uploadExtensions = Object.freeze({
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-matroska": ".mkv"
});
const deliveryTypes = Object.fromEntries(
  Object.entries(uploadExtensions).map(([mime, extension]) => [extension, mime])
);
// Older uploads may have been stored under a .jpeg extension.
deliveryTypes[".jpeg"] = "image/jpeg";

export function uploadStorageExtension(mime) {
  return typeof mime === "string" ? uploadExtensions[mime] || null : null;
}

// Never interpret legacy, user-named .html/.svg/.js/.xml/etc. uploads as
// executable same-origin documents, even if the DB authorizes their bytes.
// Unknown extensions can still be downloaded by their owner.
export function uploadDeliveryHeaders(path) {
  const mime = deliveryTypes[extname(path).toLowerCase()];
  return mime
    ? { "content-type": mime }
    : {
        "content-type": "application/octet-stream",
        "content-disposition": 'attachment; filename="download"'
      };
}

/**
 * Cheap, bounded first-line image signature gate. This is NOT a full image
 * decoder or malware scan; it prevents plain HTML/XML/script bytes from being
 * accepted merely because the caller declared a supported image MIME.
 */
export function validImageSignature(mime, data) {
  if (!Buffer.isBuffer(data)) return false;
  if (mime === "image/png") {
    return data.length >= 24 &&
      data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) &&
      data.toString("ascii", 12, 16) === "IHDR";
  }
  if (mime === "image/jpeg") {
    return data.length >= 4 &&
      data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff &&
      data[3] !== 0x00 && data[3] !== 0xff;
  }
  if (mime === "image/gif") {
    return data.length >= 10 &&
      (data.toString("ascii", 0, 6) === "GIF87a" ||
       data.toString("ascii", 0, 6) === "GIF89a");
  }
  if (mime === "image/webp") {
    return data.length >= 16 &&
      data.toString("ascii", 0, 4) === "RIFF" &&
      data.toString("ascii", 8, 12) === "WEBP" &&
      ["VP8 ", "VP8L", "VP8X"].includes(data.toString("ascii", 12, 16));
  }
  return false;
}
