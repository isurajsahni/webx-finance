import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const LOGO_TYPES = [...IMAGE_TYPES, 'image/svg+xml'];
export const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];

/** Multer in memory; the storage adapter decides where bytes end up. */
export function upload(allowedTypes, { maxFiles = 1 } = {}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: maxFiles },
    fileFilter: (_req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) cb(null, true);
      else cb(ApiError.badRequest(`Unsupported file type ${file.mimetype}`));
    },
  });
}
