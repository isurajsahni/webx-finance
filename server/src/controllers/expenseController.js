import mongoose from 'mongoose';
import { fileSafe } from '@webx/shared/numbering.js';
import { renderExpenseVoucher } from '@webx/shared/templates/index.js';
import { Expense } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { storage, storeUpload } from '../services/storage/index.js';
import { sendDocumentPdf } from '../services/pdfResponse.js';
import * as svc from '../services/expenses.js';

const oid = (v) => new mongoose.Types.ObjectId(String(v));

function filterFrom(q, isReimbursement) {
  const f = { isReimbursement };
  if (q.category) f.category = oid(q.category);
  if (q.client) f.client = oid(q.client);
  if (q.paidFrom) f.paidFrom = oid(q.paidFrom);
  if (q.mode) f.mode = q.mode;
  if (q.status) f.status = q.status;
  if (q.member) f['reimbursement.member'] = oid(q.member);
  if (q.recurring) f['recurring.enabled'] = true;
  if (q.reimbursementStatus === 'pending') f['reimbursement.status'] = { $in: ['submitted', 'approved'] };
  else if (q.reimbursementStatus) f['reimbursement.status'] = q.reimbursementStatus;
  if (q.from || q.to) f.date = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  return f;
}

async function list(req, res, isReimbursement) {
  const filter = filterFrom(req.validatedQuery, isReimbursement);
  const page = await paginate(Expense, req, {
    filter,
    searchFields: ['voucherNumber', 'vendor', 'description', 'categoryName', 'project', 'reference', 'reimbursement.payeeName', 'lines.description'],
    sortable: ['date', 'amount', 'createdAt'],
    defaultSort: '-date -createdAt',
    populate: { path: 'paidFrom', select: 'label kind' },
  });
  const [summary] = await Expense.aggregate([
    { $match: { ...filter, status: filter.status || 'active' } },
    { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
  ]);
  res.json({ ...page, summary: summary || { count: 0, amount: 0 } });
}

async function load(id, isReimbursement) {
  const doc = await Expense.findById(id);
  if (!doc || doc.isReimbursement !== isReimbursement) throw ApiError.notFound(isReimbursement ? 'Claim not found' : 'Expense not found');
  return doc;
}

/** Store uploaded bills; if the request then fails, remove them again. */
async function withBills(req, fn) {
  const bills = [];
  for (const f of req.files || []) bills.push(await storeUpload(f, 'bills'));
  try {
    return await fn(bills);
  } catch (err) {
    await Promise.all(bills.map((b) => storage.remove(b.key).catch(() => {})));
    throw err;
  }
}

const populateOne = (id) => Expense.findById(id).populate('paidFrom', 'label kind').populate('reimbursement.reimbursedFrom', 'label kind').populate('client', 'name').lean();

// ── Expenses ──
export const listExpenses = (req, res) => list(req, res, false);
export async function getExpense(req, res) {
  await load(req.params.id, false);
  res.json({ expense: await populateOne(req.params.id) });
}
export async function createExpense(req, res) {
  const doc = await withBills(req, (bills) => svc.createExpense(req.body, bills));
  res.status(201).json({ expense: doc });
}
export async function updateExpense(req, res) {
  const doc = await load(req.params.id, false);
  const saved = await withBills(req, (bills) => svc.updateExpense(doc, req.body, bills));
  res.json({ expense: saved });
}
export async function recordNext(req, res) {
  const doc = await svc.recordNextOccurrence(await load(req.params.id, false));
  res.status(201).json({ expense: doc });
}
export async function recurringDue(_req, res) {
  res.json({ items: await svc.recurringDue(7) });
}

// ── Reimbursements ──
export const listReimbursements = (req, res) => list(req, res, true);
export async function getReimbursement(req, res) {
  await load(req.params.id, true);
  res.json({ reimbursement: await populateOne(req.params.id) });
}
export async function createReimbursement(req, res) {
  const doc = await withBills(req, (bills) => svc.createReimbursement(req.body, bills, req.user));
  res.status(201).json({ reimbursement: doc });
}
export async function updateReimbursement(req, res) {
  const doc = await load(req.params.id, true);
  res.json({ reimbursement: await withBills(req, (bills) => svc.updateReimbursement(doc, req.body, bills, req.user)) });
}
export async function approve(req, res) {
  res.json({ reimbursement: await svc.approveReimbursement(await load(req.params.id, true), req.user) });
}
export async function reject(req, res) {
  res.json({ reimbursement: await svc.rejectReimbursement(await load(req.params.id, true), req.body.reason) });
}
export async function reimburse(req, res) {
  res.json({ reimbursement: await svc.markReimbursed(await load(req.params.id, true), req.body) });
}

// ── Shared ──
export const voidOne = (isReimbursement) => async (req, res) => {
  const doc = await svc.voidExpense(await load(req.params.id, isReimbursement), req.body.reason, req.user);
  res.json({ [isReimbursement ? 'reimbursement' : 'expense']: doc });
};

export const voucherPdf = (isReimbursement) => async (req, res) => {
  const doc = (await load(req.params.id, isReimbursement)).toObject();
  if (!doc.voucherNumber) throw ApiError.conflict('The voucher is created when the claim is reimbursed');
  const who = isReimbursement ? doc.reimbursement?.payeeName : doc.vendor;
  await sendDocumentPdf(req, res, {
    doc,
    render: renderExpenseVoucher,
    filename: `${isReimbursement ? 'Reimbursement' : 'Expense'}-${fileSafe(doc.voucherNumber)}-${fileSafe(who || 'Voucher')}.pdf`,
  });
};
