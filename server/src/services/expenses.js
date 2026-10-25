import { BankAccount, Client, Expense, ExpenseCategory, Settings, TeamMember } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { startOfUtcDay } from '@webx/shared/invoiceStatus.js';
import { allocateNumber } from './numbering.js';

const accountSnap = (a) => (a ? { kind: a.kind, label: a.label, bankName: a.bankName, accountNumber: a.accountNumber } : undefined);

/** Same day next month/year (clamped to month end), in UTC. */
export function addInterval(date, interval) {
  const d = new Date(date);
  const y = d.getUTCFullYear() + (interval === 'yearly' ? 1 : 0);
  const m = d.getUTCMonth() + (interval === 'monthly' ? 1 : 0);
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay)));
}

async function companySnap() {
  const c = (await Settings.get()).company;
  return { name: c.name, tagline: c.tagline, address: c.address, phones: c.phones, email: c.email, website: c.website };
}

async function account(id, path) {
  const a = await BankAccount.findById(id);
  if (!a) throw ApiError.badRequest('Account not found', [{ path, message: 'Account not found' }]);
  return a;
}

async function commonFields(body, existing) {
  const cat = await ExpenseCategory.findById(body.category);
  if (!cat) throw ApiError.badRequest('Category not found', [{ path: 'category', message: 'Category not found' }]);
  if (!cat.isActive && String(existing?.category) !== String(cat._id)) {
    throw ApiError.badRequest('This category is hidden', [{ path: 'category', message: 'This category is hidden' }]);
  }
  const client = body.client ? await Client.findById(body.client) : null;
  const lines = body.lines.filter((l) => l.amount > 0 || l.description);
  return {
    date: body.date,
    category: cat._id,
    categoryName: cat.name,
    vendor: body.vendor,
    description: body.description,
    lines,
    amount: lines.reduce((s, l) => s + l.amount, 0),
    client: client?._id || null,
    project: body.project,
    clientName: client?.name || '',
  };
}

/** Split commonFields into document fields and the client name for the snapshot. */
async function fieldsFor(body, existing) {
  const { clientName, ...fields } = await commonFields(body, existing);
  return { fields, clientName };
}

function applyBills(doc, keepBills, newBills) {
  if (keepBills) doc.bills = doc.bills.filter((b) => keepBills.includes(b.key));
  if (newBills?.length) doc.bills.push(...newBills);
  if (doc.bills.length > 10) throw ApiError.badRequest('Up to 10 bills per expense');
}

// ── Company expenses ─────────────────────────────────────

export async function createExpense(body, bills) {
  const paidFrom = await account(body.paidFrom, 'paidFrom');
  const { fields, clientName } = await fieldsFor(body);
  const doc = new Expense({
    ...fields,
    mode: body.mode,
    reference: body.reference,
    paidFrom: paidFrom._id,
    recurring: body.recurring.enabled
      ? { enabled: true, interval: body.recurring.interval, nextDueDate: body.recurring.nextDueDate || addInterval(body.date, body.recurring.interval) }
      : { enabled: false },
    snapshot: { company: await companySnap(), paidFrom: accountSnap(paidFrom), clientName },
  });
  applyBills(doc, null, bills);
  await doc.validate();
  const { number, seq, fy } = await allocateNumber('voucher', body.date);
  Object.assign(doc, { voucherNumber: number, seq, fy });
  return doc.save();
}

export async function updateExpense(doc, body, bills) {
  if (doc.status === 'void') throw ApiError.conflict('Void expenses cannot be edited');
  if (doc.isReimbursement) throw ApiError.badRequest('Use the reimbursement endpoints');
  const paidFrom = await account(body.paidFrom, 'paidFrom');
  const { fields, clientName } = await fieldsFor(body, doc);
  doc.set(fields);
  doc.set({ mode: body.mode, reference: body.reference, paidFrom: paidFrom._id, 'snapshot.paidFrom': accountSnap(paidFrom), 'snapshot.clientName': clientName });
  doc.recurring = body.recurring.enabled
    ? { enabled: true, interval: body.recurring.interval, nextDueDate: body.recurring.nextDueDate || doc.recurring?.nextDueDate || addInterval(body.date, body.recurring.interval) }
    : { enabled: false };
  applyBills(doc, body.keepBills, bills);
  return doc.save();
}

/** Record the next occurrence of a recurring expense and move its due date on. */
export async function recordNextOccurrence(source) {
  if (!source.recurring?.enabled || source.status === 'void') throw ApiError.badRequest('This expense is not recurring');
  const date = source.recurring.nextDueDate;
  const doc = new Expense({
    date,
    category: source.category,
    categoryName: source.categoryName,
    vendor: source.vendor,
    description: source.description,
    lines: source.lines,
    amount: source.amount,
    mode: source.mode,
    reference: '',
    paidFrom: source.paidFrom,
    client: source.client,
    project: source.project,
    recurringSource: source._id,
    snapshot: { company: await companySnap(), paidFrom: source.snapshot?.paidFrom, clientName: source.snapshot?.clientName },
  });
  await doc.validate();
  const { number, seq, fy } = await allocateNumber('voucher', date);
  Object.assign(doc, { voucherNumber: number, seq, fy });
  await doc.save();
  source.recurring.nextDueDate = addInterval(date, source.recurring.interval);
  await source.save();
  return doc;
}

/** Recurring expenses due within `days` days (or overdue). */
export function recurringDue(days = 7) {
  const until = new Date(startOfUtcDay().getTime() + days * 86400000);
  return Expense.find({ 'recurring.enabled': true, status: 'active', 'recurring.nextDueDate': { $lte: until } }).sort('recurring.nextDueDate').lean();
}

// ── Reimbursements ───────────────────────────────────────

async function payeeFields(body, user) {
  if (body.payeeType === 'member') {
    const m = await TeamMember.findById(body.member);
    if (!m) throw ApiError.badRequest('Team member not found', [{ path: 'member', message: 'Team member not found' }]);
    return { payeeType: 'member', member: m._id, payeeName: m.name, payeeRole: m.role };
  }
  return { payeeType: 'owner', member: null, payeeName: body.payeeName || user.name, payeeRole: 'Owner' };
}

export async function createReimbursement(body, bills, user) {
  const { fields, clientName } = await fieldsFor(body);
  const doc = new Expense({
    ...fields,
    isReimbursement: true,
    reimbursement: { ...(await payeeFields(body, user)), status: 'submitted' },
    snapshot: { company: await companySnap(), clientName },
  });
  applyBills(doc, null, bills);
  return doc.save();
}

export async function updateReimbursement(doc, body, bills, user) {
  if (!doc.isReimbursement) throw ApiError.badRequest('Not a reimbursement');
  if (doc.status === 'void' || doc.reimbursement.status !== 'submitted') throw ApiError.conflict('Only submitted claims can be edited');
  const { fields, clientName } = await fieldsFor(body, doc);
  doc.set(fields);
  doc.set('snapshot.clientName', clientName);
  const payee = await payeeFields(body, user);
  Object.assign(doc.reimbursement, payee);
  applyBills(doc, body.keepBills, bills);
  return doc.save();
}

function assertStatus(doc, allowed, action) {
  if (!doc.isReimbursement) throw ApiError.badRequest('Not a reimbursement');
  if (doc.status === 'void') throw ApiError.conflict('This claim is void');
  if (!allowed.includes(doc.reimbursement.status)) throw ApiError.conflict(`Cannot ${action} a claim that is ${doc.reimbursement.status}`);
}

export async function approveReimbursement(doc, user) {
  assertStatus(doc, ['submitted'], 'approve');
  Object.assign(doc.reimbursement, { status: 'approved', approvedBy: user._id, approvedAt: new Date() });
  doc.$locals.auditAction = 'status';
  return doc.save();
}

export async function rejectReimbursement(doc, reason) {
  assertStatus(doc, ['submitted', 'approved'], 'reject');
  Object.assign(doc.reimbursement, { status: 'rejected', rejectedReason: reason });
  doc.$locals.auditAction = 'status';
  return doc.save();
}

export async function markReimbursed(doc, body) {
  assertStatus(doc, ['approved'], 'reimburse');
  const from = await account(body.paidFrom, 'paidFrom');
  Object.assign(doc.reimbursement, { status: 'reimbursed', reimbursedAt: body.date, reimbursedFrom: from._id, mode: body.mode, reference: body.reference });
  doc.set('snapshot.reimbursedFrom', accountSnap(from));
  const { number, seq, fy } = await allocateNumber('voucher', body.date);
  Object.assign(doc, { voucherNumber: number, seq, fy });
  doc.$locals.auditAction = 'status';
  return doc.save();
}

export async function voidExpense(doc, reason, user) {
  if (doc.status === 'void') throw ApiError.conflict('Already void');
  Object.assign(doc, { status: 'void', voidReason: reason, voidedAt: new Date(), voidedBy: user._id });
  if (doc.recurring?.enabled) doc.recurring.enabled = false;
  doc.$locals.auditAction = 'void';
  return doc.save();
}
