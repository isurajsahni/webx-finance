import path from 'node:path';
import { storage } from '../services/storage/index.js';
import { ApiError } from '../utils/ApiError.js';

const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf', '.svg': 'image/svg+xml' };

// Serves uploaded files to signed-in users. Locked-down CSP so an uploaded SVG
// or PDF can never run script in the app's origin.
export async function serveFile(req, res) {
  const key = [].concat(req.params.key).join('/');
  if (!(await storage.exists(key).catch(() => false))) throw ApiError.notFound('File not found');
  res.set({
    'Content-Type': TYPES[path.extname(key)] || 'application/octet-stream',
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    'Cache-Control': 'private, max-age=3600',
    'Content-Disposition': req.query.download ? `attachment; filename="${path.basename(key)}"` : 'inline',
  });
  storage.stream(key).pipe(res);
}
