// Import a data export (made from the local database) into another MongoDB, e.g. Atlas.
//
//   npm run import:data -w server -- ../exports/local-2026-11-11            # dry run: shows what would change
//   npm run import:data -w server -- ../exports/local-2026-11-11 --apply    # replace the data
//
// The connection string is asked for in a hidden prompt (or read from TARGET_MONGODB_URI),
// so it never lands in your shell history. Each exported collection replaces the same
// collection in the target. Users already in the target whose email is not in the export
// are kept, so the login you use on the hosted app keeps working.
// The target must not hold real business data yet (invoices, payments…), unless --force.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { MongoClient, BSON } from 'mongodb';

const { EJSON } = BSON;
const BUSINESS = ['invoices', 'payments', 'quotes', 'clients', 'expenses', 'payouts', 'ledgerentries'];

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer.trim()); });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const force = args.includes('--force');
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) throw new Error('Pass the export folder, e.g. ../exports/local-2026-11-11');
  const dbDir = fs.existsSync(path.join(dir, 'database')) ? path.join(dir, 'database') : dir;
  const files = fs.readdirSync(dbDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  if (!files.length) throw new Error(`No collection files in ${dbDir}`);

  const uri = process.env.TARGET_MONGODB_URI?.trim() || (await askHidden('Target MongoDB connection string (hidden): '));
  if (!/^mongodb(\+srv)?:\/\//.test(uri) || uri.includes('xxxxx')) throw new Error('That is not a usable MongoDB connection string.');

  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    const db = client.db();
    const host = uri.replace(/\/\/[^@]*@/, '//').split('/')[2];
    console.log(`Target: ${host}, database "${db.databaseName}"${apply ? '' : '  (dry run, nothing is changed)'}\n`);

    const data = Object.fromEntries(files.map((f) => [f.replace(/\.json$/, ''), EJSON.parse(fs.readFileSync(path.join(dbDir, f), 'utf8'), { relaxed: true })]));
    const rows = [];
    for (const [name, docs] of Object.entries(data)) rows.push({ collection: name, 'in target now': await db.collection(name).countDocuments(), 'after import': docs.length });

    // Keep target users the export doesn't have (your hosted login).
    const exportedEmails = new Set((data.users || []).map((u) => u.email));
    const exportedIds = new Set((data.users || []).map((u) => String(u._id)));
    const keepUsers = data.users
      ? (await db.collection('users').find().toArray()).filter((u) => !exportedEmails.has(u.email) && !exportedIds.has(String(u._id)))
      : [];
    const usersRow = rows.find((r) => r.collection === 'users');
    if (usersRow) usersRow['after import'] += keepUsers.length;
    console.table(rows);
    if (keepUsers.length) console.log(`Keeping ${keepUsers.length} user(s) already in the target: ${keepUsers.map((u) => `${u.email} (${u.role})`).join(', ')}`);

    const busy = rows.filter((r) => BUSINESS.includes(r.collection) && r['in target now'] > 0);
    if (busy.length && !force) {
      throw new Error(`The target already has ${busy.map((r) => `${r['in target now']} ${r.collection}`).join(', ')}. These would be replaced. Re-run with --force if that is what you want.`);
    }
    if (!apply) {
      console.log('\nDry run only. Add --apply to import.');
      return;
    }

    for (const [name, docs] of Object.entries(data)) {
      const col = db.collection(name);
      await col.deleteMany({});
      const toInsert = name === 'users' ? [...docs, ...keepUsers] : docs;
      if (toInsert.length) await col.insertMany(toInsert, { ordered: true });
      console.log(`✓ ${name}: ${toInsert.length}`);
    }
    console.log('\nImport complete. Restart the app (Render → Manual Deploy → Restart service) so it picks up the new settings.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(`\nImport failed: ${err.message}`);
  process.exit(1);
});
