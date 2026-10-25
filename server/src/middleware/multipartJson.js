import { ApiError } from '../utils/ApiError.js';

/**
 * For multipart requests that carry a file plus structured data: the data is
 * sent as a JSON string in the `data` field. Replaces req.body with the parsed
 * object so the normal Zod validation applies.
 */
export function multipartJson(req, _res, next) {
  if (!req.is('multipart/form-data')) return next();
  if (typeof req.body?.data !== 'string') return next(ApiError.badRequest('Missing data field'));
  try {
    req.body = JSON.parse(req.body.data);
    next();
  } catch {
    next(ApiError.badRequest('Invalid JSON in data field'));
  }
}
