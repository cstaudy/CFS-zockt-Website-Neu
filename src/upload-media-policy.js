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
      data[3] !== 0x00;
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

/**
 * Read a bounded EBML variable-length unsigned integer. Used only for the
 * small EBML document header, not for decoding entire video files.
 */
function ebmlSize(data, offset, end) {
  if (offset >= end) return null;
  const first = data[offset];
  let length = 1;
  while (length <= 8 && !(first & (0x80 >> (length - 1)))) length++;
  if (length > 8 || offset + length > end) return null;
  let value = first & (0xff >> length);
  let allOnes = value === (0xff >> length);
  for (let i = 1; i < length; i++) {
    value = value * 256 + data[offset + i];
    allOnes = allOnes && data[offset + i] === 0xff;
  }
  if (allOnes || !Number.isSafeInteger(value)) return null;
  return { length, value };
}

function ebmlDocumentType(data) {
  if (data.length < 9 || !data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])))
    return null;
  const headerSize = ebmlSize(data, 4, data.length);
  if (!headerSize || headerSize.value > 4096) return null;
  const end = 4 + headerSize.length + headerSize.value;
  if (end > data.length) return null;
  let position = 4 + headerSize.length;
  while (position < end) {
    // EBML element identifiers use the leading-one length marker,
    // but unlike value sizes, the marker is part of the element ID.
    const first = data[position];
    let idLength = 1;
    while (idLength <= 4 && !(first & (0x80 >> (idLength - 1)))) idLength++;
    if (idLength > 4 || position + idLength > end) return null;
    const isDocType = idLength === 2 && data[position] === 0x42 &&
      data[position + 1] === 0x82;
    position += idLength;
    const size = ebmlSize(data, position, end);
    if (!size) return null;
    position += size.length;
    if (position + size.value > end) return null;
    if (isDocType) {
      return size.value === 4 || size.value === 8
        ? data.toString("ascii", position, position + size.value) : null;
    }
    position += size.value;
  }
  return null;
}

/**
 * First-line video container gate, NOT a video decoder or virus scanner.
 * Checks ISO BMFF ftyp brands (MP4/QuickTime) and EBML DocType
 * (WebM/Matroska) before writing raw uploaded bytes to disk.
 */
export function validVideoSignature(mime, data) {
  if (!Buffer.isBuffer(data)) return false;
  if (mime === "video/mp4" || mime === "video/quicktime") {
    if (data.length < 16 || data.toString("ascii", 4, 8) !== "ftyp") return false;
    const boxSize = data.readUInt32BE(0);
    if (boxSize < 16 || boxSize > data.length) return false;
    const brand = data.toString("ascii", 8, 12);
    return mime === "video/quicktime" ? brand === "qt  " :
      brand !== "qt  " && /^[a-zA-Z0-9 ]{4}$/.test(brand);
  }
  if (mime === "video/webm" || mime === "video/x-matroska") {
    const docType = ebmlDocumentType(data);
    return docType === (mime === "video/webm" ? "webm" : "matroska");
  }
  return false;
}
