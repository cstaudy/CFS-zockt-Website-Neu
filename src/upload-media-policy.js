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
