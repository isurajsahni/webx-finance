import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { LocalStorage } from './LocalStorage.js';
import { ApiError } from '../../utils/ApiError.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function createStorage() {
  switch (env.STORAGE_DRIVER) {
    case 'local':
    default:
      return new LocalStorage(path.resolve(serverRoot, env.UPLOAD_DIR));
  }
}

export const storage = createStorage();

const SIGNATURES = {
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  'application/pdf': (b) => b.subarray(0, 5).toString() === '%PDF-',
  'image/svg+xml': (b) => /<svg[\s>]/i.test(b.subarray(0, 2048).toString('utf8')),
};

const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'application/pdf': '.pdf', 'image/svg+xml': '.svg' };

/** Validate an uploaded file's real content against its declared type, then store it. */
export async function storeUpload(file, folder) {
  const check = SIGNATURES[file.mimetype];
  if (!check || !check(file.buffer)) {
    throw ApiError.badRequest('File content does not match its type');
  }
  const saved = await storage.save(file.buffer, { folder, ext: EXT[file.mimetype] });
  return { ...saved, originalName: file.originalname.slice(0, 200), mimeType: file.mimetype, size: file.size };
}
