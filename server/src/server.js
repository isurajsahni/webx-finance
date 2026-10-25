import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { resolveMongoUri, stopLocalMongo } from './config/resolveDb.js';
import { ensureLocalSeed } from './services/seed.js';
import { runMigrations } from './services/migrations.js';
import { createApp } from './app.js';
import { closePdfBrowser } from './services/pdf.js';

async function main() {
  await connectDb(await resolveMongoUri());
  await runMigrations();
  if (env.useLocalMongo) await ensureLocalSeed();

  const server = createApp().listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));
  server.on('error', (err) => {
    console.error(err.code === 'EADDRINUSE' ? `Port ${env.PORT} is already in use. Stop the other process or change PORT in server/.env.` : err);
    process.exit(1);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await closePdfBrowser();
      await disconnectDb();
      await stopLocalMongo();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(async (err) => {
  console.error('\nFailed to start the API:', err.message);
  if (/querySrv|ENOTFOUND|ECONNREFUSED|Server selection timed out|bad auth|Authentication failed/i.test(err.message)) {
    console.error('Check MONGODB_URI in server/.env, and that your IP is allowed in Atlas → Network Access.');
  }
  await stopLocalMongo().catch(() => {});
  process.exit(1);
});
