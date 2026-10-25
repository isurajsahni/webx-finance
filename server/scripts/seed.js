// Idempotent seed: creates the owner user, settings with company defaults, one
// placeholder bank account, the cash account and the default expense categories.
//
//   npm run seed                              # create what is missing
//   npm run seed -- --reset-owner-password    # also reset the owner's password from .env
import { connectDb, disconnectDb } from '../src/config/db.js';
import { resolveMongoUri, stopLocalMongo } from '../src/config/resolveDb.js';
import { seedDatabase } from '../src/services/seed.js';

async function main() {
  await connectDb(await resolveMongoUri());
  await seedDatabase({ resetPassword: process.argv.includes('--reset-owner-password') });
  await disconnectDb();
  await stopLocalMongo();
  console.log('Seed complete.');
}

main().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await disconnectDb().catch(() => {});
  await stopLocalMongo().catch(() => {});
  process.exit(1);
});
