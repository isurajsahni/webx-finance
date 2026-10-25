import { BankAccount } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

async function clearOtherDefaults(id) {
  const others = await BankAccount.find({ _id: { $ne: id }, isDefault: true });
  for (const acc of others) {
    acc.isDefault = false;
    await acc.save();
  }
}

export async function listBankAccounts(req, res) {
  const filter = req.query.includeInactive === '1' ? {} : { isActive: true };
  const items = await BankAccount.find(filter).sort({ isDefault: -1, kind: 1, label: 1 }).lean();
  res.json({ items });
}

export async function getBankAccount(req, res) {
  const account = await BankAccount.findById(req.params.id).lean();
  if (!account) throw ApiError.notFound('Account not found');
  res.json({ account });
}

export async function createBankAccount(req, res) {
  const hasDefault = await BankAccount.exists({ isDefault: true, isActive: true });
  const isBank = req.body.kind === 'bank';
  const account = new BankAccount({ ...req.body, isDefault: isBank && (req.body.isDefault || !hasDefault) });
  await account.save();
  if (account.isDefault) await clearOtherDefaults(account._id);
  res.status(201).json({ account });
}

export async function updateBankAccount(req, res) {
  const account = await BankAccount.findById(req.params.id);
  if (!account) throw ApiError.notFound('Account not found');
  if (account.isSystem && req.body.kind !== account.kind) throw ApiError.badRequest('System account type cannot change');
  const { isDefault, ...rest } = req.body;
  account.set(rest);
  if (isDefault && account.isActive && account.kind === 'bank') account.isDefault = true;
  if (account.kind !== 'bank') account.isDefault = false;
  await account.save();
  if (account.isDefault) await clearOtherDefaults(account._id);
  res.json({ account });
}

export async function makeDefault(req, res) {
  const account = await BankAccount.findById(req.params.id);
  if (!account) throw ApiError.notFound('Account not found');
  if (!account.isActive) throw ApiError.badRequest('Activate the account before making it default');
  if (account.kind !== 'bank') throw ApiError.badRequest('Only a bank account can be the default for invoices');
  account.isDefault = true;
  await account.save();
  await clearOtherDefaults(account._id);
  res.json({ account });
}

export async function setActive(req, res) {
  const active = req.path.endsWith('/activate');
  const account = await BankAccount.findById(req.params.id);
  if (!account) throw ApiError.notFound('Account not found');
  if (account.isSystem && !active) throw ApiError.badRequest('The cash account cannot be deactivated');
  account.isActive = active;
  if (!active && account.isDefault) account.isDefault = false;
  await account.save();
  res.json({ account });
}
