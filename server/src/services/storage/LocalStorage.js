import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Stores files on local disk under `root`. Any other adapter (S3, Cloudinary)
 * must implement the same methods: save, read, stream, remove, exists.
 */
export class LocalStorage {
  constructor(root) {
    this.name = 'local';
    this.root = path.resolve(root);
  }

  resolve(key) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async save(buffer, { folder = 'misc', ext = '' } = {}) {
    const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, '');
    const key = `${safeFolder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${ext}`;
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer, { flag: 'wx' });
    return { key, storage: this.name };
  }

  read(key) {
    return fs.readFile(this.resolve(key));
  }

  stream(key) {
    return createReadStream(this.resolve(key));
  }

  async exists(key) {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key) {
    await fs.rm(this.resolve(key), { force: true });
  }
}
