// Idempotent seed: creates whatever is missing, never overwrites existing data.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_EXPENSE_CATEGORIES } from '@webx/shared/constants.js';
import { User, Settings, BankAccount, ExpenseCategory } from '../models/index.js';
import { runAs } from '../utils/context.js';
import { password as passwordRule } from '../validators/auth.js';

const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');

async function seedOwner({ email, name, password, resetPassword }) {
  let owner = await User.findOne({ email }).select('+passwordHash');
  if (owner && !resetPassword) {
    console.log(`✓ Owner ${email} already exists`);
    return owner;
  }
  const check = passwordRule.safeParse(password ?? '');
  if (!check.success) throw new Error(`SEED_OWNER_PASSWORD: ${check.error.issues[0].message}`);

  const creating = !owner;
  if (creating) owner = new User({ name, email, role: 'owner' });
  await owner.setPassword(password);
  await owner.save();
  console.log(`✓ Owner ${email} ${creating ? 'created' : 'password updated'}`);
  return owner;
}

async function seedRest() {
  await Settings.get();
  console.log('✓ Settings ready (company defaults)');

  if (!(await BankAccount.exists({ kind: 'bank' }))) {
    await new BankAccount({
      kind: 'bank',
      label: 'Primary bank (placeholder)',
      payableTo: 'The Web{X} Studio',
      bankName: 'Your Bank Name',
      branch: 'Branch, City',
      accountNumber: '000000000000',
      ifsc: 'ABCD0000000',
      isDefault: true,
    }).save();
    console.log('✓ Placeholder bank account created: replace it in Settings → Bank accounts');
  }

  if (!(await BankAccount.exists({ kind: 'cash', isSystem: true }))) {
    await new BankAccount({ kind: 'cash', label: 'Cash in hand', isSystem: true }).save();
    console.log('✓ Cash account created');
  }

  let added = 0;
  for (const [i, name] of DEFAULT_EXPENSE_CATEGORIES.entries()) {
    const exists = await ExpenseCategory.findOne({ name }).collation({ locale: 'en', strength: 2 });
    if (!exists) {
      await new ExpenseCategory({ name, sortOrder: i + 1 }).save();
      added++;
    }
  }
  console.log(`✓ Expense categories (${added} added)`);
}

/** Read owner details from process.env (server/.env). */
export function ownerFromEnv() {
  return {
    email: process.env.SEED_OWNER_EMAIL?.trim().toLowerCase(),
    name: process.env.SEED_OWNER_NAME?.trim() || 'Owner',
    password: process.env.SEED_OWNER_PASSWORD,
  };
}

export async function seedDatabase({ resetPassword = false } = {}) {
  const owner = ownerFromEnv();
  if (!owner.email) throw new Error('Set SEED_OWNER_EMAIL in server/.env');
  const user = await seedOwner({ ...owner, resetPassword });
  await runAs(user, seedRest);
  return user;
}

/**
 * Local development only: if the database has no users yet, seed it. When no
 * SEED_OWNER_PASSWORD is set, generate one and save it into server/.env so the
 * owner can sign in (it is never printed).
 */
export async function ensureLocalSeed() {
  if (await User.exists({})) return;

  if (!process.env.SEED_OWNER_EMAIL) process.env.SEED_OWNER_EMAIL = 'owner@example.com';
  if (!passwordRule.safeParse(process.env.SEED_OWNER_PASSWORD ?? '').success) {
    const generated = `Webx${crypto.randomBytes(5).toString('hex')}7`;
    process.env.SEED_OWNER_PASSWORD = generated;
    if (fs.existsSync(envFile)) {
      const text = fs.readFileSync(envFile, 'utf8');
      const next = /^SEED_OWNER_PASSWORD=.*$/m.test(text)
        ? text.replace(/^SEED_OWNER_PASSWORD=.*$/m, `SEED_OWNER_PASSWORD=${generated}`)
        : `${text.trimEnd()}\nSEED_OWNER_PASSWORD=${generated}\n`;
      fs.writeFileSync(envFile, next);
    }
    console.log('Generated an owner password and saved it as SEED_OWNER_PASSWORD in server/.env');
  }

  console.log('Empty local database, seeding…');
  await seedDatabase();
  console.log(`\n  Sign in with ${process.env.SEED_OWNER_EMAIL} and the SEED_OWNER_PASSWORD from server/.env\n`);
}

/**
 * Hosted databases (Atlas): no shell needed. If there are no users yet, create
 * the owner and defaults from SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD. With
 * SEED_RESET_OWNER_PASSWORD=true, also set that owner's password from the env
 * (and create the owner if that email has no account). Never stops the server.
 */
export async function ensureOwnerFromEnv() {
  const reset = process.env.SEED_RESET_OWNER_PASSWORD === 'true';
  const hasUsers = await User.exists({});
  if (hasUsers && !reset) return;

  const { email, password } = ownerFromEnv();
  if (!email || !password) {
    console.warn('No owner can sign in yet: set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD in the environment, then restart.');
    return;
  }
  try {
    await seedDatabase({ resetPassword: reset });
    console.log(`Owner ready: sign in with ${email} and SEED_OWNER_PASSWORD.`);
    if (reset) console.warn('SEED_RESET_OWNER_PASSWORD is on: remove it now, or the password is reset on every restart.');
  } catch (err) {
    console.error(`Could not set up the owner: ${err.message}`);
  }
}
