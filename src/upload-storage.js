import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const configured = process.env.ASSET_UPLOAD_ROOT?.trim();
if (configured && !isAbsolute(configured)) throw new Error('ASSET_UPLOAD_ROOT muss ein absoluter Pfad sein.');
export const uploadRoot = configured
  ? resolve(configured)
  : resolve(fileURLToPath(new URL('../assets/uploads/', import.meta.url)));
export const persistentUploadsConfigured = Boolean(configured);
