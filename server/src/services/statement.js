// Client statement of account: invoices (debit) and payments/TDS (credit) with a running balance, in INR.
import mongoose from 'mongoose';
import { Invoice, Payment } from '../models/index.js';

const oid = (v) => new mongoose.Types.ObjectId(String(v));

async function entries(clientId) {
  const [invoices, payments] = await Promise.all([
    Invoice.find({ client: oid(clientId), status: { $nin: ['draft', 'cancelled'] } }).select('number issueDate dueDate dueText total totalInr currency items').lean(),
    Payment.find({ client: oid(clientId), status: 'active' }).select('receiptNumber invoiceNumber date amountInr tdsInr mode reference purpose').lean(),
  ]);
  const rows = [
    ...invoices.map((i) => ({
      date: i.issueDate, type: 'Invoice', ref: i.number, description: i.items?.[0]?.title || 'Invoice', debit: i.totalInr, credit: 0, link: `/invoices/${i._id}`,
    })),
    ...payments.flatMap((p) => [
      { date: p.date, type: 'Payment', ref: p.receiptNumber, description: `${{ advance: 'Advance', part: 'Part payment', final: 'Final payment' }[p.purpose] || 'Payment'} against ${p.invoiceNumber}${p.reference ? ` · ${p.reference}` : ''}`, debit: 0, credit: p.amountInr, link: `/payments/${p._id}` },
      ...(p.tdsInr > 0 ? [{ date: p.date, type: 'TDS', ref: p.receiptNumber, description: `TDS deducted against ${p.invoiceNumber}`, debit: 0, credit: p.tdsInr, link: `/payments/${p._id}` }] : []),
    ]),
  ];
  // Same day: invoice before the payment that settles it.
  return rows.sort((a, b) => new Date(a.date) - new Date(b.date) || (a.type === 'Invoice' ? -1 : 1));
}

export async function clientStatement(clientId, { from, to } = {}) {
  const all = await entries(clientId);
  let opening = 0;
  const rows = [];
  for (const r of all) {
    const d = new Date(r.date);
    if (from && d < from) opening += r.debit - r.credit;
    else if (!to || d <= to) rows.push(r);
  }
  let balance = opening;
  for (const r of rows) r.balance = balance += r.debit - r.credit;
  const totals = rows.reduce((t, r) => ({ debit: t.debit + r.debit, credit: t.credit + r.credit }), { debit: 0, credit: 0 });
  return { opening, rows, totals, closing: balance };
}
