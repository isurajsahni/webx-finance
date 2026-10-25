// Reports on a cash basis (when money actually moved), in INR paise.
//   Income   = client payments received + TDS deducted by clients
//   Expenses = company expenses + reimbursements paid + team payouts (net)
// Owner investment/withdrawal, transfers and adjustments are not income or expense.

import { fyRange, fyLabel, fyStartYear } from '@webx/shared/fy.js';
import { MONTHS } from '@webx/shared/constants.js';
import { startOfUtcDay } from '@webx/shared/invoiceStatus.js';
import { periodEnd, periodStart } from '@webx/shared/handover.js';
import { Expense, Invoice, Payment, Payout, Settings } from '../models/index.js';
import { ledgerRows, accountBalances } from './ledger.js';

const range = (from, to) => (from || to ? { ...(from && { $gte: from }), ...(to && { $lte: to }) } : undefined);
const withDate = (match, field, from, to) => {
  const r = range(from, to);
  return r ? { ...match, [field]: r } : match;
};
const monthKey = (d) => `${new Date(d).getUTCFullYear()}-${String(new Date(d).getUTCMonth() + 1).padStart(2, '0')}`;

async function fyStartMonth() {
  return (await Settings.get()).fyStartMonth || 4;
}

/** Income rows: one per payment, amount = cash + TDS. */
async function incomeRows(from, to) {
  return Payment.find(withDate({ status: 'active' }, 'date', from, to)).select('date amountInr tdsInr client snapshot.client.name').lean();
}

/** Expense rows from all three sources, with a category label. */
async function expenseRows(from, to) {
  const [exp, reimb, pay] = await Promise.all([
    Expense.find(withDate({ status: 'active', isReimbursement: false }, 'date', from, to)).select('date amount categoryName').lean(),
    Expense.find(withDate({ status: 'active', isReimbursement: true, 'reimbursement.status': 'reimbursed' }, 'reimbursement.reimbursedAt', from, to))
      .select('reimbursement.reimbursedAt amount categoryName')
      .lean(),
    Payout.find(withDate({ status: 'active' }, 'date', from, to)).select('date net snapshot.member.type').lean(),
  ]);
  return [
    ...exp.map((e) => ({ date: e.date, amount: e.amount, category: e.categoryName || 'Uncategorised', source: 'expense' })),
    ...reimb.map((e) => ({ date: e.reimbursement.reimbursedAt, amount: e.amount, category: e.categoryName || 'Uncategorised', source: 'reimbursement' })),
    ...pay.map((p) => ({ date: p.date, amount: p.net, category: p.snapshot?.member?.type === 'employee' ? 'Salaries' : 'Team payouts (freelancers)', source: 'payout' })),
  ];
}

/** Month-by-month P&L for one financial year. */
export async function pnlByMonth(fyDate = new Date()) {
  const startMonth = await fyStartMonth();
  const { from, to } = fyRange(fyDate, startMonth);
  const end = new Date(to.getTime() - 1);
  const [inc, exp] = await Promise.all([incomeRows(from, end), expenseRows(from, end)]);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    return { key: monthKey(d), label: `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${String(d.getUTCFullYear()).slice(2)}`, income: 0, expenses: 0, net: 0 };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const p of inc) {
    const m = byKey.get(monthKey(p.date));
    if (m) m.income += p.amountInr + (p.tdsInr || 0);
  }
  for (const e of exp) {
    const m = byKey.get(monthKey(e.date));
    if (m) m.expenses += e.amount;
  }
  for (const m of months) m.net = m.income - m.expenses;
  const totals = months.reduce((t, m) => ({ income: t.income + m.income, expenses: t.expenses + m.expenses, net: t.net + m.net }), { income: 0, expenses: 0, net: 0 });
  return { fy: fyLabel(fyDate, startMonth), from, to: end, months, totals };
}

/** Totals for every financial year that has data. */
export async function pnlByFy() {
  const startMonth = await fyStartMonth();
  const [inc, exp] = await Promise.all([incomeRows(), expenseRows()]);
  const map = new Map();
  const row = (d) => {
    const fy = fyLabel(d, startMonth);
    if (!map.has(fy)) map.set(fy, { fy, startYear: fyStartYear(d, startMonth), income: 0, expenses: 0, net: 0 });
    return map.get(fy);
  };
  for (const p of inc) row(p.date).income += p.amountInr + (p.tdsInr || 0);
  for (const e of exp) row(e.date).expenses += e.amount;
  const rows = [...map.values()].sort((a, b) => b.startYear - a.startYear);
  for (const r of rows) r.net = r.income - r.expenses;
  return { rows };
}

export async function incomeByClient(from, to) {
  const rows = await Payment.aggregate([
    { $match: withDate({ status: 'active' }, 'date', from, to) },
    { $group: { _id: '$client', name: { $last: '$snapshot.client.name' }, received: { $sum: '$amountInr' }, tds: { $sum: '$tdsInr' }, payments: { $sum: 1 } } },
    { $set: { total: { $add: ['$received', '$tds'] } } },
    { $sort: { total: -1 } },
  ]);
  const total = rows.reduce((s, r) => s + r.total, 0);
  return { rows: rows.map((r) => ({ client: r._id, name: r.name, received: r.received, tds: r.tds, total: r.total, payments: r.payments, share: total ? r.total / total : 0 })), total };
}

export async function expenseByCategory(from, to) {
  const rows = await expenseRows(from, to);
  const map = new Map();
  for (const r of rows) {
    const m = map.get(r.category) || { category: r.category, amount: 0, count: 0 };
    m.amount += r.amount;
    m.count += 1;
    map.set(r.category, m);
  }
  const list = [...map.values()].sort((a, b) => b.amount - a.amount);
  const total = list.reduce((s, r) => s + r.amount, 0);
  return { rows: list.map((r) => ({ ...r, share: total ? r.amount / total : 0 })), total };
}

const BUCKETS = [
  { key: 'current', label: 'Not yet due' },
  { key: 'd30', label: '1–30 days' },
  { key: 'd60', label: '31–60 days' },
  { key: 'd90', label: '61–90 days' },
  { key: 'd90plus', label: '90+ days' },
];

/** Unpaid invoice balances by how long they are overdue (from due date, else invoice date). */
export async function receivablesAgeing(asOf = new Date()) {
  const today = startOfUtcDay(asOf);
  const invoices = await Invoice.find({ status: { $in: ['sent', 'partly_paid'] }, balanceDue: { $gt: 0 } })
    .select('number client snapshot.client.name issueDate dueDate dueText balanceDue exchangeRate currency total')
    .lean();
  const clients = new Map();
  const totals = Object.fromEntries([...BUCKETS.map((b) => [b.key, 0]), ['total', 0]]);
  const detail = [];
  for (const inv of invoices) {
    const ref = inv.dueDate || inv.issueDate;
    const days = Math.floor((today - startOfUtcDay(ref)) / 86400000);
    const key = inv.dueDate && days <= 0 ? 'current' : days <= 30 ? 'd30' : days <= 60 ? 'd60' : days <= 90 ? 'd90' : 'd90plus';
    const amount = Math.round(inv.balanceDue * (inv.exchangeRate || 1));
    const c = clients.get(String(inv.client)) || { client: inv.client, name: inv.snapshot?.client?.name, ...Object.fromEntries([...BUCKETS.map((b) => [b.key, 0]), ['total', 0]]), invoices: 0 };
    c[key] += amount;
    c.total += amount;
    c.invoices += 1;
    clients.set(String(inv.client), c);
    totals[key] += amount;
    totals.total += amount;
    detail.push({ _id: inv._id, number: inv.number, client: inv.snapshot?.client?.name, issueDate: inv.issueDate, dueDate: inv.dueDate, daysOverdue: Math.max(0, days), bucket: key, amount, currency: inv.currency, balanceDue: inv.balanceDue });
  }
  return { asOf: today, buckets: BUCKETS, rows: [...clients.values()].sort((a, b) => b.total - a.total), totals, invoices: detail.sort((a, b) => b.daysOverdue - a.daysOverdue) };
}

export async function payoutSummary(from, to) {
  const rows = await Payout.aggregate([
    { $match: withDate({ status: 'active' }, 'date', from, to) },
    {
      $group: {
        _id: '$member', name: { $last: '$snapshot.member.name' }, role: { $last: '$snapshot.member.role' }, type: { $last: '$snapshot.member.type' },
        count: { $sum: 1 }, gross: { $sum: { $add: ['$gross', '$bonus'] } }, deductions: { $sum: '$totalDeductions' }, net: { $sum: '$net' },
      },
    },
    { $sort: { net: -1 } },
  ]);
  const totals = rows.reduce((t, r) => ({ count: t.count + r.count, gross: t.gross + r.gross, deductions: t.deductions + r.deductions, net: t.net + r.net }), { count: 0, gross: 0, deductions: 0, net: 0 });
  return { rows: rows.map(({ _id, ...r }) => ({ member: _id, ...r })), totals };
}

/** GST charged on invoices issued in the period (accrual: by invoice date), in INR. */
export async function gstSummary(from, to) {
  const toInr = (f) => ({ $round: [{ $multiply: [f, '$exchangeRate'] }, 0] });
  const rows = await Invoice.aggregate([
    { $match: withDate({ status: { $nin: ['draft', 'cancelled'] }, 'gst.enabled': true }, 'issueDate', from, to) },
    {
      $group: {
        _id: { y: { $year: '$issueDate' }, m: { $month: '$issueDate' } },
        invoices: { $sum: 1 }, taxable: { $sum: toInr('$taxable') }, cgst: { $sum: toInr('$gst.cgst') }, sgst: { $sum: toInr('$gst.sgst') }, igst: { $sum: toInr('$gst.igst') },
      },
    },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
  ]);
  const list = rows.map((r) => ({ month: `${MONTHS[r._id.m - 1].slice(0, 3)} ${r._id.y}`, invoices: r.invoices, taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst, total: r.cgst + r.sgst + r.igst }));
  const totals = list.reduce((t, r) => ({ invoices: t.invoices + r.invoices, taxable: t.taxable + r.taxable, cgst: t.cgst + r.cgst, sgst: t.sgst + r.sgst, igst: t.igst + r.igst, total: t.total + r.total }), { invoices: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
  return { enabled: (await Settings.get()).gst.enabled, rows: list, totals };
}

/** Free hosting / maintenance ending within `aheadDays`, or ended within the last `behindDays`. */
export async function renewalsDue({ aheadDays = 45, behindDays = 30 } = {}) {
  const today = startOfUtcDay();
  const invoices = await Invoice.find({ status: { $ne: 'cancelled' }, 'handover.enabled': true, $or: [{ 'handover.handoverDate': { $ne: null } }, { 'handover.startDate': { $ne: null } }] })
    .select('number client snapshot.client.name handover')
    .lean();
  const rows = [];
  for (const inv of invoices) {
    for (const [kind, months] of [['Hosting', inv.handover.hostingMonths], ['Maintenance', inv.handover.maintenanceMonths]]) {
      const end = periodEnd(periodStart(inv.handover), months);
      if (!end) continue;
      const daysLeft = Math.round((end - today) / 86400000);
      if (daysLeft <= aheadDays && daysLeft >= -behindDays) {
        rows.push({ invoice: inv._id, number: inv.number, client: inv.client, clientName: inv.snapshot?.client?.name, kind, endDate: end, daysLeft });
      }
    }
  }
  return rows.sort((a, b) => a.daysLeft - b.daysLeft);
}

export async function dashboard(from, to) {
  const [inc, exp, monthly, categories, ageing, pendingReimb, unpaid, recent, balances] = await Promise.all([
    incomeRows(from, to),
    expenseRows(from, to),
    pnlByMonth(to || new Date()),
    expenseByCategory(from, to),
    receivablesAgeing(),
    Expense.aggregate([
      { $match: { status: 'active', isReimbursement: true, 'reimbursement.status': { $in: ['submitted', 'approved'] } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    Invoice.find({ status: { $in: ['sent', 'partly_paid'] }, balanceDue: { $gt: 0 } })
      .sort({ dueDate: 1, issueDate: 1 })
      .limit(8)
      .select('number status snapshot.client.name issueDate dueDate dueText total balanceDue currency amountPaid tdsAmount')
      .lean(),
    ledgerRows({}),
    accountBalances(),
  ]);
  const renewals = await renewalsDue();
  const income = inc.reduce((s, p) => s + p.amountInr + (p.tdsInr || 0), 0);
  const expenses = exp.reduce((s, e) => s + e.amount, 0);
  return {
    range: { from, to },
    cards: {
      income,
      expenses,
      net: income - expenses,
      outstanding: ageing.totals.total,
      overdue: ageing.totals.d30 + ageing.totals.d60 + ageing.totals.d90 + ageing.totals.d90plus,
      pendingReimbursements: pendingReimb[0] ? { count: pendingReimb[0].count, amount: pendingReimb[0].amount } : { count: 0, amount: 0 },
    },
    monthly,
    categories,
    unpaidInvoices: unpaid,
    recent: recent.slice(-8).reverse(),
    balances,
    renewals,
  };
}

