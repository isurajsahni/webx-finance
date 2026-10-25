// Development fallback: when no Atlas URI is configured, run a real MongoDB
// locally (binary managed by mongodb-memory-server) with data persisted in
// server/.data/db, so `npm run dev` works out of the box.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const PORT = 27018;
const DB_NAME = 'webx_finance';
const dbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.data/db');

let instance = null;

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

/** Returns a connection URI, starting the local MongoDB if it is not already running. */
export async function startLocalMongo() {
  const uri = `mongodb://127.0.0.1:${PORT}/${DB_NAME}`;
  // Already running (e.g. dev server is up and you run `npm run seed`)? Reuse it.
  if (await portInUse(PORT)) return uri;

  fs.mkdirSync(dbPath, { recursive: true });
  console.log('No MongoDB Atlas URI in server/.env, starting a local MongoDB (data in server/.data/db)…');
  console.log('(The first start downloads MongoDB once, ~75 MB.)');
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  instance = await MongoMemoryServer.create({
    instance: { port: PORT, dbPath, storageEngine: 'wiredTiger', dbName: DB_NAME },
  });
  return uri;
}

export async function stopLocalMongo() {
  if (instance) await instance.stop({ doCleanup: false });
  instance = null;
}
