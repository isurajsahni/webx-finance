// The ledger is computed from the source records (payments, payouts,
// expenses, reimbursements) plus manual entries, so it can never drift out of
// sync with them. Amounts are INR paise. Voided records are excluded.
import mongoose from 'mongoose';
import { BankAccount, Expense, LedgerEntry, Payment, Payout } from '../models/index.js';

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const coll = (Model) => Model.collection.name;

const ROW = (o) => ({
  _id: 0,
  date: 1,
  type: { $literal: o.type },
  direction: { $literal: o.direction },
  amount: o.amount,
  account: o.account,
  client: o.client ?? { $literal: null },
  member: o.member ?? { $literal: null },
  category: o.category ?? { $literal: null },
  categoryName: o.categoryName ?? { $literal: null },
  docNumber: o.docNumber ?? { $literal: null },
  reference: o.reference ?? { $literal: null },
  party: o.party ?? { $literal: null },
  description: o.description ?? { $literal: null },
  sourceModel: { $literal: o.sourceModel },
  sourceId: '$_id',
});

function pipelines() {
  const payments = [
    { $match: { status: 'active' } },
    { $project: ROW({ type: 'invoice_payment', direction: 'in', amount: '$amountInr', account: '$bankAccount', client: '$client', docNumber: '$receiptNumber', reference: '$reference', party: '$snapshot.client.name', description: { $concat: ['Payment against invoice ', { $ifNull: ['$invoiceNumber', ''] }] }, sourceModel: 'Payment' }) },
  ];
  const payouts = [
    { $match: { status: 'active' } },
    { $project: ROW({ type: 'payout', direction: 'out', amount: '$net', account: '$paidFrom', member: '$member', client: '$client', docNumber: '$voucherNumber', reference: '$reference', party: '$snapshot.member.name', description: { $trim: { input: { $concat: [{ $ifNull: ['$periodLabel', ''] }, ' ', { $ifNull: ['$project', ''] }] } } }, sourceModel: 'Payout' }) },
  ];
  const expenses = [
    { $match: { status: 'active', isReimbursement: false } },
    { $project: ROW({ type: 'expense', direction: 'out', amount: '$amount', account: '$paidFrom', client: '$client', category: '$category', categoryName: '$categoryName', docNumber: '$voucherNumber', reference: '$reference', party: '$vendor', description: { $ifNull: [{ $arrayElemAt: ['$lines.description', 0] }, '$description'] }, sourceModel: 'Expense' }) },
  ];
  // Reimbursements leave the bank when they are paid back, so they use that date.
  const reimbursements = [
    { $match: { status: 'active', isReimbursement: true, 'reimbursement.status': 'reimbursed' } },
    { $addFields: { date: '$reimbursement.reimbursedAt' } },
    { $project: ROW({ type: 'reimbursement', direction: 'out', amount: '$amount', account: '$reimbursement.reimbursedFrom', member: '$reimbursement.member', client: '$client', category: '$category', categoryName: '$categoryName', docNumber: '$voucherNumber', reference: '$reimbursement.reference', party: '$reimbursement.payeeName', description: { $ifNull: [{ $arrayElemAt: ['$lines.description', 0] }, '$description'] }, sourceModel: 'Expense' }) },
  ];
  // A transfer is two rows: out of one account, into the other.
  const manual = [
    { $match: { status: 'active' } },
    {
      $set: {
        legs: {
          $switch: {
            branches: [
              { case: { $eq: ['$type', 'transfer'] }, then: [{ account: '$account', direction: 'out' }, { account: '$toAccount', direction: 'in' }] },
              { case: { $in: ['$type', ['owner_investment', 'adjustment_in']] }, then: [{ account: '$account', direction: 'in' }] },
            ],
            default: [{ account: '$account', direction: 'out' }],
          },
        },
      },
    },
    { $unwind: '$legs' },
    {
      $project: {
        _id: 0, date: 1, type: 1, direction: '$legs.direction', amount: 1, account: '$legs.account',
        client: { $literal: null }, member: { $literal: null }, category: { $literal: null }, categoryName: { $literal: null },
        docNumber: { $literal: null }, reference: 1, party: { $literal: null }, description: 1, sourceModel: { $literal: 'LedgerEntry' }, sourceId: '$_id',
      },
    },
  ];
  return { payments, payouts, expenses, reimbursements, manual };
}

/** All ledger rows matching the filters, oldest first. */
export async function ledgerRows(f = {}) {
  const p = pipelines();
  const match = {};
  if (f.from || f.to) match.date = { ...(f.from && { $gte: f.from }), ...(f.to && { $lte: f.to }) };
  if (f.account) match.account = oid(f.account);
  if (f.type) match.type = Array.isArray(f.type) ? { $in: f.type } : f.type;
  if (f.direction) match.direction = f.direction;
  if (f.category) match.category = oid(f.category);
  if (f.client) match.client = oid(f.client);
  if (f.member) match.member = oid(f.member);
  if (f.search) {
    const rx = new RegExp(f.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [{ docNumber: rx }, { reference: rx }, { party: rx }, { description: rx }, { categoryName: rx }];
  }

  return Payment.aggregate([
    ...p.payments,
    { $unionWith: { coll: coll(Payout), pipeline: p.payouts } },
    { $unionWith: { coll: coll(Expense), pipeline: p.expenses } },
    { $unionWith: { coll: coll(Expense), pipeline: p.reimbursements } },
    { $unionWith: { coll: coll(LedgerEntry), pipeline: p.manual } },
    { $match: match },
    { $lookup: { from: coll(BankAccount), localField: 'account', foreignField: '_id', as: 'acc', pipeline: [{ $project: { label: 1, kind: 1 } }] } },
    { $set: { accountLabel: { $first: '$acc.label' } } },
    { $unset: 'acc' },
    { $sort: { date: 1, sourceId: 1, direction: -1 } },
  ]);
}

const signed = (r) => (r.direction === 'in' ? r.amount : -r.amount);

/**
 * Ledger page. With an account filter, every row carries the running balance
 * of that account (opening balance + everything before `from`).
 */
export async function ledgerPage(f, { page = 1, limit = 50 } = {}) {
  const rows = await ledgerRows(f);
  let opening = null;
  if (f.account) {
    const acc = await BankAccount.findById(f.account).lean();
    opening = acc?.openingBalance ?? 0;
    if (f.from) {
      const before = await ledgerRows({ account: f.account, to: new Date(f.from.getTime() - 1) });
      opening += before.reduce((s, r) => s + signed(r), 0);
    }
    let bal = opening;
    for (const r of rows) r.balance = bal += signed(r);
  }
  const totals = rows.reduce((t, r) => ((t[r.direction] += r.amount), t), { in: 0, out: 0 });
  const newestFirst = rows.reverse();
  const start = (page - 1) * limit;
  return {
    items: newestFirst.slice(start, start + limit),
    total: rows.length,
    page,
    limit,
    pages: Math.max(1, Math.ceil(rows.length / limit)),
    totals: { ...totals, net: totals.in - totals.out },
    openingBalance: opening,
    closingBalance: opening === null ? null : opening + totals.in - totals.out,
  };
}

/** Current (or as-of) balance of every account. */
export async function accountBalances(asOf) {
  const [accounts, rows] = await Promise.all([BankAccount.find().sort({ isDefault: -1, kind: 1, label: 1 }).lean(), ledgerRows(asOf ? { to: asOf } : {})]);
  const sums = new Map();
  for (const r of rows) sums.set(String(r.account), (sums.get(String(r.account)) || 0) + signed(r));
  return accounts.map((a) => ({ _id: a._id, label: a.label, kind: a.kind, isActive: a.isActive, isDefault: a.isDefault, openingBalance: a.openingBalance, balance: a.openingBalance + (sums.get(String(a._id)) || 0) }));
}
