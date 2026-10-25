import { z } from 'zod';
import { LEDGER_TYPE_LABELS, LEDGER_TYPES } from '@webx/shared/constants.js';
import { formatLongDate } from '@webx/shared/fy.js';
import { BankAccount, LedgerEntry, Settings, MANUAL_TYPES } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { objectId, businessDate, optStr, minor } from '../validators/common.js';
import { ledgerPage, accountBalances } from '../services/ledger.js';
import * as R from '../services/reports.js';
import { sendExport } from '../services/exporters.js';

const format = z.enum(['json', 'csv', 'xlsx', 'pdf']).default('json');
const rangeQuery = z.object({ from: businessDate.optional(), to: businessDate.optional(), format });
const periodText = (from, to) => (from || to ? `${from ? formatLongDate(from) : 'Start'} – ${to ? formatLongDate(to) : 'Today'}` : 'All time');

// ── Ledger ───────────────────────────────────────────────
const ledgerQuery = z.object({
  from: businessDate.optional(),
  to: businessDate.optional(),
  account: objectId.optional(),
  type: z.enum(LEDGER_TYPES).optional(),
  direction: z.enum(['in', 'out']).optional(),
  category: objectId.optional(),
  client: objectId.optional(),
  member: objectId.optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  format,
});

export async function ledger(req, res) {
  const q = ledgerQuery.parse(req.query);
  if (q.format === 'json') return res.json(await ledgerPage(q, { page: q.page, limit: q.limit }));

  const page = await ledgerPage(q, { page: 1, limit: 1_000_000 });
  const acc = q.account ? await BankAccount.findById(q.account).lean() : null;
  const columns = [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'typeLabel', label: 'Type', type: 'text' },
    { key: 'docNumber', label: 'Doc no.', type: 'text', width: 18 },
    { key: 'party', label: 'Party', type: 'text', width: 22 },
    { key: 'description', label: 'Description', type: 'text', width: 30 },
    { key: 'categoryName', label: 'Category', type: 'text' },
    { key: 'accountLabel', label: 'Account', type: 'text', width: 18 },
    { key: 'reference', label: 'Reference', type: 'text' },
    { key: 'in', label: 'Money in', type: 'money' },
    { key: 'out', label: 'Money out', type: 'money' },
    ...(acc ? [{ key: 'balance', label: 'Balance', type: 'money' }] : []),
  ];
  const rows = page.items.reverse().map((r) => ({ ...r, typeLabel: LEDGER_TYPE_LABELS[r.type], in: r.direction === 'in' ? r.amount : null, out: r.direction === 'out' ? r.amount : null }));
  const def = {
    title: 'Ledger',
    subtitle: `${acc ? `${acc.label} · ` : ''}${periodText(q.from, q.to)}${acc ? ` · Opening ${(page.openingBalance / 100).toLocaleString('en-IN')} · Closing ${(page.closingBalance / 100).toLocaleString('en-IN')}` : ''}`,
    sheets: [{ name: 'Ledger', columns, rows, total: { description: 'Total', in: page.totals.in, out: page.totals.out, ...(acc ? { balance: page.closingBalance } : {}) } }],
  };
  return sendExport(req, res, def, q.format, `Ledger-${acc ? acc.label + '-' : ''}${new Date().toISOString().slice(0, 10)}`);
}

export async function balances(req, res) {
  const { asOf } = z.object({ asOf: businessDate.optional() }).parse(req.query);
  res.json({ items: await accountBalances(asOf) });
}

const entryBody = z
  .object({
    type: z.enum(MANUAL_TYPES),
    date: businessDate,
    amount: minor.positive('Amount must be more than 0'),
    account: objectId,
    toAccount: objectId.optional().nullable(),
    description: optStr(300),
    reference: optStr(80),
  })
  .refine((v) => v.type !== 'transfer' || (v.toAccount && v.toAccount !== v.account), { path: ['toAccount'], message: 'Choose a different account to transfer to' });

export async function createEntry(req, res) {
  const body = entryBody.parse(req.body);
  for (const id of [body.account, body.toAccount].filter(Boolean)) {
    if (!(await BankAccount.exists({ _id: id }))) throw ApiError.badRequest('Account not found');
  }
  if (body.type !== 'transfer') body.toAccount = null;
  res.status(201).json({ entry: await new LedgerEntry(body).save() });
}

export async function voidEntry(req, res) {
  const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
  const e = await LedgerEntry.findById(req.params.id);
  if (!e) throw ApiError.notFound('Entry not found');
  if (e.status === 'void') throw ApiError.conflict('Already void');
  Object.assign(e, { status: 'void', voidReason: reason, voidedAt: new Date(), voidedBy: req.user._id });
  e.$locals.auditAction = 'void';
  res.json({ entry: await e.save() });
}

export async function listEntries(_req, res) {
  res.json({ items: await LedgerEntry.find().sort({ date: -1 }).limit(200).populate('account toAccount', 'label').lean() });
}

// ── Dashboard ────────────────────────────────────────────
export async function dashboard(req, res) {
  const { from, to } = rangeQuery.parse(req.query);
  res.json(await R.dashboard(from, to));
}

// ── Reports ──────────────────────────────────────────────
const money = (key, label) => ({ key, label, type: 'money' });

async function fyToDate(fy) {
  if (!fy) return new Date();
  const start = Number(fy.slice(0, 4));
  const startMonth = (await Settings.get()).fyStartMonth || 4;
  return new Date(Date.UTC(start, startMonth - 1, 1));
}

export async function pnl(req, res) {
  const q = z.object({ fy: z.string().regex(/^\d{4}(-\d{2})?$/).optional(), format }).parse(req.query);
  const data = await R.pnlByMonth(await fyToDate(q.fy));
  if (q.format === 'json') return res.json(data);
  return sendExport(req, res, {
    title: 'Profit & Loss',
    subtitle: `Financial year ${data.fy} · cash basis`,
    sheets: [{ name: `P&L ${data.fy}`, columns: [{ key: 'label', label: 'Month', type: 'text' }, money('income', 'Income'), money('expenses', 'Expenses'), money('net', 'Net profit')], rows: data.months, total: { label: 'Total', ...data.totals } }],
  }, q.format, `Profit-and-Loss-FY-${data.fy}`);
}

export async function pnlFy(req, res) {
  const q = z.object({ format }).parse(req.query);
  const data = await R.pnlByFy();
  if (q.format === 'json') return res.json(data);
  return sendExport(req, res, {
    title: 'Profit & Loss',
    subtitle: 'By financial year · cash basis',
    sheets: [{ name: 'By financial year', columns: [{ key: 'fy', label: 'Financial year', type: 'text' }, money('income', 'Income'), money('expenses', 'Expenses'), money('net', 'Net profit')], rows: data.rows }],
  }, q.format, 'Profit-and-Loss-by-FY');
}

export async function incomeByClient(req, res) {
  const q = rangeQuery.parse(req.query);
  const data = await R.incomeByClient(q.from, q.to);
  if (q.format === 'json') return res.json(data);
  return sendExport(req, res, {
    title: 'Income by Client',
    subtitle: periodText(q.from, q.to),
    sheets: [{ name: 'Income by client', columns: [{ key: 'name', label: 'Client', type: 'text', width: 28 }, { key: 'payments', label: 'Payments', type: 'number' }, money('received', 'Received'), money('tds', 'TDS'), money('total', 'Total'), { key: 'share', label: 'Share', type: 'percent' }], rows: data.rows, total: { name: 'Total', total: data.total, share: data.total ? 1 : 0 } }],
  }, q.format, 'Income-by-Client');
}

export async function expenseByCategory(req, res) {
  const q = rangeQuery.parse(req.query);
  const data = await R.expenseByCategory(q.from, q.to);
  if (q.format === 'json') return res.json(data);
  return sendExport(req, res, {
    title: 'Expenses by Category',
    subtitle: periodText(q.from, q.to),
    sheets: [{ name: 'Expenses by category', columns: [{ key: 'category', label: 'Category', type: 'text', width: 28 }, { key: 'count', label: 'Entries', type: 'number' }, money('amount', 'Amount'), { key: 'share', label: 'Share', type: 'percent' }], rows: data.rows, total: { category: 'Total', amount: data.total, share: data.total ? 1 : 0 } }],
  }, q.format, 'Expenses-by-Category');
}

export async function receivables(req, res) {
  const q = z.object({ format }).parse(req.query);
  const data = await R.receivablesAgeing();
  if (q.format === 'json') return res.json(data);
  return sendExport(req, res, {
    title: 'Receivables',
    subtitle: `Outstanding as of ${formatLongDate(data.asOf)}`,
    sheets: [
      { name: 'Ageing by client', columns: [{ key: 'name', label: 'Client', type: 'text', width: 26 }, ...data.buckets.map((b) => money(b.key, b.label)), money('total', 'Total')], rows: data.rows, total: { name: 'Total', ...data.totals } },
      { name: 'Unpaid invoices', columns: [{ key: 'number', label: 'Invoice', type: 'text', width: 16 }, { key: 'client', label: 'Client', type: 'text', width: 24 }, { key: 'issueDate', label: 'Date', type: 'date' }, { key: 'dueDate', label: 'Due', type: 'date' }, { key: 'daysOverdue', label: 'Days overdue', type: 'number' }, money('amount', 'Outstanding')], rows: data.invoices },
    ],
  }, q.format, 'Receivables-Ageing');
}

export async function payouts(req, res) {
  const q = rangeQuery.parse(req.query);
  const data = await R.payoutSummary(q.from, q.to);
  if (q.format === 'json') return res.json(data);
  return sendExport(req, res, {
    title: 'Payout Summary',
    subtitle: periodText(q.from, q.to),
    sheets: [{ name: 'Payouts by member', columns: [{ key: 'name', label: 'Team member', type: 'text', width: 24 }, { key: 'type', label: 'Type', type: 'text' }, { key: 'count', label: 'Payouts', type: 'number' }, money('gross', 'Gross + bonus'), money('deductions', 'Deductions'), money('net', 'Net paid')], rows: data.rows, total: { name: 'Total', ...data.totals } }],
  }, q.format, 'Payout-Summary');
}

export async function gst(req, res) {
  const q = rangeQuery.parse(req.query);
  const data = await R.gstSummary(q.from, q.to);
  if (q.format === 'json') return res.json(data);
  return sendExport(req, res, {
    title: 'GST Summary',
    subtitle: `${periodText(q.from, q.to)} · output tax on invoices issued`,
    sheets: [{ name: 'GST by month', columns: [{ key: 'month', label: 'Month', type: 'text' }, { key: 'invoices', label: 'Invoices', type: 'number' }, money('taxable', 'Taxable value'), money('cgst', 'CGST'), money('sgst', 'SGST'), money('igst', 'IGST'), money('total', 'Total GST')], rows: data.rows, total: { month: 'Total', ...data.totals } }],
  }, q.format, 'GST-Summary');
}

