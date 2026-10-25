import mongoose from 'mongoose';
import { BankAccount, Invoice, Payment, Settings } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { allocateNumber } from './numbering.js';
import { applyPaymentState, finalizeInvoice } from './invoices.js';

/**
 * Recalculate an invoice's paid / TDS / balance / status from its active
 * payments. Always derived from the payments themselves, so it is safe to call
 * any number of times.
 */
export async function syncInvoicePayments(invoiceId) {
  const [sum] = await Payment.aggregate([
    { $match: { invoice: new mongoose.Types.ObjectId(String(invoiceId)), status: 'active' } },
    { $group: { _id: null, amount: { $sum: '$amount' }, tds: { $sum: '$tds' } } },
  ]);
  const inv = await Invoice.findById(invoiceId);
  inv.amountPaid = sum?.amount ?? 0;
  inv.tdsAmount = sum?.tds ?? 0;
  const before = inv.status;
  applyPaymentState(inv);
  if (inv.status !== before) inv.$locals.auditAction = 'status';
  await inv.save();
  return inv;
}

async function resolveAccount(id, mode, invoice) {
  if (id) {
    const acc = await BankAccount.findById(id);
    if (!acc) throw ApiError.badRequest('Account not found', [{ path: 'bankAccount', message: 'Account not found' }]);
    return acc;
  }
  if (mode === 'cash') return BankAccount.findOne({ kind: 'cash', isActive: true }).sort({ isSystem: -1 });
  return (invoice.bankAccount && (await BankAccount.findById(invoice.bankAccount))) || BankAccount.findOne({ isDefault: true, isActive: true });
}

/** advance = first payment on an advance invoice; final = settles it; part = anything else. */
export function paymentPurpose(invoice, settledBefore, balanceAfter) {
  if (balanceAfter <= 0) return 'final';
  if (invoice.split?.type === 'advance' && settledBefore === 0) return 'advance';
  return 'part';
}

export async function recordPayment(body, proof) {
  const invoice = await Invoice.findById(body.invoice);
  if (!invoice) throw ApiError.badRequest('Invoice not found', [{ path: 'invoice', message: 'Invoice not found' }]);
  if (invoice.status === 'cancelled') throw ApiError.conflict('This invoice is cancelled');
  if (invoice.status === 'paid') throw ApiError.conflict('This invoice is already fully paid');
  // Receiving money means the invoice has gone to the client: finalise (and number) it first.
  if (invoice.status === 'draft') await finalizeInvoice(invoice);

  const settled = invoice.amountPaid + invoice.tdsAmount;
  const remaining = invoice.total - settled;
  if (body.amount + body.tds > remaining) {
    throw ApiError.badRequest('More than the balance due', [{ path: 'amount', message: `Balance due is ${(remaining / 100).toFixed(2)} ${invoice.currency}` }]);
  }

  const account = await resolveAccount(body.bankAccount, body.mode, invoice);
  const settings = await Settings.get();
  const company = settings.company;
  const rate = invoice.currency === 'INR' ? 1 : body.exchangeRate || invoice.exchangeRate;

  const payment = new Payment({
    receiptNumber: 'pending',
    invoice: invoice._id,
    invoiceNumber: invoice.number,
    client: invoice.client,
    date: body.date,
    amount: body.amount,
    tds: body.tds,
    currency: invoice.currency,
    exchangeRate: rate,
    amountInr: Math.round(body.amount * rate),
    tdsInr: Math.round(body.tds * rate),
    mode: body.mode,
    reference: body.reference,
    bankAccount: account?._id,
    notes: body.notes,
    proof,
    snapshot: {
      client: (({ name, secondaryName, address, city, state, pincode, country, phone, email, gstin, logo }) => ({ name, secondaryName, address, city, state, pincode, country, phone, email, gstin, logo }))(invoice.snapshot.client || {}),
      company: { name: company.name, tagline: company.tagline, address: company.address, phones: company.phones, email: company.email, website: company.website },
      bank: account ? { kind: account.kind, label: account.label, bankName: account.bankName, accountNumber: account.accountNumber } : undefined,
      invoice: { number: invoice.number, total: invoice.total, title: invoice.items[0]?.title, issueDate: invoice.issueDate },
    },
    previouslyReceived: settled,
    balanceAfter: remaining - body.amount - body.tds,
    purpose: paymentPurpose(invoice, settled, remaining - body.amount - body.tds),
  });
  await payment.validate(); // before consuming a receipt number
  const { number, seq, fy } = await allocateNumber('receipt', body.date);
  Object.assign(payment, { receiptNumber: number, seq, fy });
  await payment.save();

  const updated = await syncInvoicePayments(invoice._id);
  return { payment, invoice: updated };
}

/** "Already paid" on the invoice form: record each payment received before billing, oldest first, each with its own receipt. */
export async function recordPastPayments(invoice, paid) {
  const payments = [];
  let updated = invoice;
  for (const p of [...paid].sort((a, b) => new Date(a.date) - new Date(b.date))) {
    const res = await recordPayment({ ...p, invoice: invoice._id });
    payments.push(res.payment);
    updated = res.invoice;
  }
  return { payments, invoice: updated };
}

export async function voidPayment(payment, reason, user) {
  if (payment.status === 'void') throw ApiError.conflict('This payment is already void');
  payment.status = 'void';
  payment.voidReason = reason;
  payment.voidedAt = new Date();
  payment.voidedBy = user._id;
  payment.$locals.auditAction = 'void';
  await payment.save();
  const invoice = await syncInvoicePayments(payment.invoice);
  return { payment, invoice };
}
