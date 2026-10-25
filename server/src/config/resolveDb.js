import { env } from './env.js';
import { startLocalMongo, stopLocalMongo } from './localMongo.js';

/** Real URI from .env, or a local MongoDB in development when none is configured. */
export async function resolveMongoUri() {
  return env.useLocalMongo ? startLocalMongo() : env.MONGODB_URI;
}

export { stopLocalMongo };
