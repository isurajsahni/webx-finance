// Permanent deletion (owner only). Unlike void/cancel, the record is removed
// from the database together with its attached files. If the record holds the
// latest number in its series, that number is released and used again by the
// next document; otherwise the number stays as a gap in the series.
import { counterKey } from '@webx/shared/numbering.js';
import { Client, Counter, Expense, Invoice, LedgerEntry, Payment, Payout, Quote, Settings, recordAudit } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { storage } from './storage/index.js';
import { syncInvoicePayments } from './payments.js';

/** Give the number back if it is the last one issued in its series. */
async function releaseNumber(type, doc) {
  if (!doc?.seq || !doc.fy) return;
  const settings = await Settings.get();
  const key = counterKey(type, doc.fy, settings.numbering?.[type]?.includeFy ?? true);
  await Counter.updateOne({ _id: key, seq: doc.seq }, { $inc: { seq: -1 } });
}

async function removeFiles(keys) {
  await Promise.all(keys.filter(Boolean).map((k) => storage.remove(k).catch(() => {})));
}

function audit(user, ip, entity, doc, label) {
  return recordAudit({ actor: user._id, actorName: user.name, action: 'delete', entity, entityId: doc._id, label, ip });
}

async function find(Model, id, what) {
  const doc = await Model.findById(id);
  if (!doc) throw ApiError.notFound(`${what} not found`);
  return doc;
}

/** Remove payments, newest number first so the series can wind back. */
async function removePayments(payments, user, ip) {
  for (const p of [...payments].sort((a, b) => (b.seq || 0) - (a.seq || 0))) {
    await Payment.deleteOne({ _id: p._id });
    await releaseNumber('receipt', p);
    await removeFiles([p.proof?.key]);
    await audit(user, ip, 'Payment', p, p.receiptNumber);
  }
}

export async function deletePayment(id, user, ip) {
  const p = await find(Payment, id, 'Payment');
  await removePayments([p], user, ip);
  const invoice = (await Invoice.exists({ _id: p.invoice })) ? await syncInvoicePayments(p.invoice) : null;
  return { invoice };
}

/** Deletes the invoice and every payment recorded against it. */
export async function deleteInvoice(id, user, ip) {
  const inv = await find(Invoice, id, 'Invoice');
  const payments = await Payment.find({ invoice: inv._id });
  await removePayments(payments, user, ip);
  await Invoice.deleteOne({ _id: inv._id });
  await releaseNumber('invoice', inv);
  // A quote converted into this invoice can be converted again.
  await Quote.updateMany({ invoice: inv._id }, { $unset: { invoice: 1 }, $set: { status: 'accepted' } });
  await audit(user, ip, 'Invoice', inv, inv.number || 'Draft invoice');
  return { payments: payments.length };
}

export async function deleteQuote(id, user, ip) {
  const q = await find(Quote, id, 'Quote');
  await Quote.deleteOne({ _id: q._id });
  await releaseNumber('quote', q);
  await Invoice.updateMany({ quote: q._id }, { $unset: { quote: 1 } });
  await audit(user, ip, 'Quote', q, q.number || 'Draft quote');
  return {};
}

export async function deleteExpense(id, isReimbursement, user, ip) {
  const doc = await find(Expense, id, isReimbursement ? 'Claim' : 'Expense');
  if (doc.isReimbursement !== isReimbursement) throw ApiError.notFound(isReimbursement ? 'Claim not found' : 'Expense not found');
  await Expense.deleteOne({ _id: doc._id });
  await releaseNumber('voucher', doc);
  await removeFiles((doc.bills || []).map((b) => b.key));
  await Expense.updateMany({ recurringSource: doc._id }, { $unset: { recurringSource: 1 } });
  await audit(user, ip, 'Expense', doc, doc.voucherNumber || doc.vendor || doc.description);
  return {};
}

export async function deletePayout(id, user, ip) {
  const p = await find(Payout, id, 'Payout');
  await Payout.deleteOne({ _id: p._id });
  await releaseNumber('payslip', p);
  await audit(user, ip, 'Payout', p, p.voucherNumber);
  return {};
}

export async function deleteLedgerEntry(id, user, ip) {
  const e = await find(LedgerEntry, id, 'Entry');
  await LedgerEntry.deleteOne({ _id: e._id });
  await audit(user, ip, 'LedgerEntry', e, e.description || e.reference);
  return {};
}

/** A client with invoices or quotes can't be deleted (the documents keep a copy of the client); archive it instead. */
export async function deleteClient(id, user, ip) {
  const c = await find(Client, id, 'Client');
  const [invoices, quotes] = await Promise.all([Invoice.countDocuments({ client: c._id }), Quote.countDocuments({ client: c._id })]);
  if (invoices || quotes) {
    const what = [invoices && `${invoices} invoice${invoices > 1 ? 's' : ''}`, quotes && `${quotes} quote${quotes > 1 ? 's' : ''}`].filter(Boolean).join(' and ');
    throw ApiError.conflict(`${c.name} has ${what}. Delete those first, or archive the client instead.`);
  }
  await Client.deleteOne({ _id: c._id });
  await removeFiles([c.logo?.key]);
  await audit(user, ip, 'Client', c, c.name);
  return {};
}
