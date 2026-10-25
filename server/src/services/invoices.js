import { computeInvoice, splitNote, gstModeFor } from '@webx/shared/invoiceMath.js';
import { isIndia, stateCodeFor } from '@webx/shared/india.js';
import { formatDocNumber } from '@webx/shared/numbering.js';
import { fyLabel } from '@webx/shared/fy.js';
import { BankAccount, Client, Invoice, Settings } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { allocateNumber, registerManualSeq } from './numbering.js';

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj?.[k] ?? '']));
const CLIENT_SNAP = ['name', 'secondaryName', 'contactPerson', 'email', 'phone', 'address', 'city', 'state', 'stateCode', 'pincode', 'country', 'gstin', 'pan', 'website'];
const COMPANY_SNAP = ['name', 'tagline', 'address', 'state', 'stateCode', 'email', 'website', 'gstin', 'pan'];
const BANK_SNAP = ['label', 'payableTo', 'bankName', 'branch', 'accountNumber', 'ifsc', 'swift', 'upiId'];

/**
 * Handover terms as stored on the document. The included / not-included lists
 * are copied from Settings (unless given), so later edits there never change
 * what an issued invoice or quote promised.
 */
export function handoverFields(input, existing, settings) {
  const d = settings.handoverDefaults || {};
  const h = input ?? existing ?? { enabled: !!d.enabledByDefault, hostingMonths: d.hostingMonths, maintenanceMonths: d.maintenanceMonths };
  if (!h.enabled) return { enabled: false, hostingMonths: 0, maintenanceMonths: 0 };
  return {
    enabled: true,
    hostingMonths: h.hostingMonths || 0,
    maintenanceMonths: h.maintenanceMonths || 0,
    handoverDate: h.handoverDate || null,
    startDate: h.startDate || null,
    includes: h.includes?.length ? h.includes : existing?.includes?.length ? existing.includes : [...(d.includes || [])],
    excludes: h.excludes?.length ? h.excludes : existing?.excludes?.length ? existing.excludes : [...(d.excludes || [])],
  };
}

/** Recompute stored status and balance from totals and payments. */
export function applyPaymentState(inv) {
  inv.balanceDue = Math.max(0, inv.total - inv.amountPaid - inv.tdsAmount);
  if (inv.status === 'cancelled') return inv;
  const settled = inv.amountPaid + inv.tdsAmount;
  if (inv.total > 0 && settled >= inv.total) inv.status = 'paid';
  else if (settled > 0) inv.status = 'partly_paid';
  else if (inv.status === 'paid' || inv.status === 'partly_paid') inv.status = 'sent';
  return inv;
}

async function resolveClient(body) {
  if (body.newClient) {
    // Typed inline on the invoice form: saved as a real client.
    const nc = body.newClient;
    return new Client({ ...nc, stateCode: isIndia(nc.country) ? stateCodeFor(nc.state) || nc.gstin?.slice(0, 2) || '' : '' }).save();
  }
  const client = await Client.findById(body.client);
  if (!client) throw ApiError.badRequest('Client not found', [{ path: 'client', message: 'Client not found' }]);
  return client;
}

async function resolveBank(id) {
  const bank = id ? await BankAccount.findById(id) : await BankAccount.findOne({ isDefault: true, isActive: true });
  if (id && !bank) throw ApiError.badRequest('Bank account not found', [{ path: 'bankAccount', message: 'Bank account not found' }]);
  return bank;
}

/** Build every derived field of an invoice from the request body. Never trusts client-side totals. */
export async function buildInvoiceFields(body, { client, existing } = {}) {
  const settings = await Settings.get();
  const company = settings.company.toObject();
  client ??= await resolveClient(body);
  const bank = await resolveBank(body.bankAccount);

  const gstEnabled = settings.gst.enabled && body.gstEnabled;
  const computed = computeInvoice({
    items: body.items,
    discount: body.discount,
    gst: { enabled: gstEnabled, rate: body.gstRate ?? settings.gst.defaultRate, mode: gstModeFor(company, client) },
    split: body.split,
  });

  const dueDate = body.dueDate || null;
  const note = body.noteIsCustom && body.note ? body.note : splitNote({ split: computed.split, total: computed.total, currency: body.currency, dueDate, paid: paidSummary(body.paid) });

  const amountPaid = existing?.amountPaid ?? 0;
  const tdsAmount = existing?.tdsAmount ?? 0;

  return {
    client: client._id,
    snapshot: {
      client: { ...pick(client, CLIENT_SNAP), logo: client.logo?.key ? { key: client.logo.key, mimeType: client.logo.mimeType } : undefined },
      company: { ...pick(company, COMPANY_SNAP), phones: company.phones || [] },
      bank: bank && bank.kind === 'bank' ? pick(bank, BANK_SNAP) : undefined,
    },
    issueDate: body.issueDate,
    dueDate,
    dueText: body.dueText || (dueDate ? '' : settings.invoiceDefaults.dueText),
    currency: body.currency,
    exchangeRate: body.currency === 'INR' ? 1 : body.exchangeRate,
    items: computed.items.map(({ title, description, sac, qty, rate, amount }) => ({ title, description, sac, qty, rate, amount })),
    discount: body.discount,
    discountAmount: computed.discountAmount,
    subtotal: computed.subtotal,
    taxable: computed.taxable,
    gst: computed.gst,
    total: computed.total,
    totalInr: Math.round(computed.total * (body.currency === 'INR' ? 1 : body.exchangeRate)),
    split: computed.split,
    bankAccount: bank?._id,
    note,
    noteIsCustom: !!(body.noteIsCustom && body.note),
    terms: body.terms ?? existing?.terms ?? settings.invoiceDefaults.terms,
    handover: handoverFields(body.handover, existing?.handover, settings),
    amountPaid,
    tdsAmount,
  };
}

/** Use a typed number if given (must be unique), otherwise allocate the next one. */
/** Give an invoice (or quote: type/Model) the next number, or a typed one if unique. */
export async function assignNumber(doc, manual, { type = 'invoice', Model = Invoice } = {}) {
  const settings = await Settings.get();
  const fy = fyLabel(doc.issueDate, settings.fyStartMonth);
  if (!manual) {
    const { number, seq } = await allocateNumber(type, doc.issueDate);
    Object.assign(doc, { number, seq, fy });
    return;
  }
  if (await Model.exists({ number: manual })) {
    throw ApiError.conflict(`Number ${manual} is already used`, [{ path: 'number', message: 'This number is already used' }]);
  }
  // If the manual number fits the configured series, move the counter past it
  // so automatic numbering never produces it again.
  const seq = Number(manual.match(/(\d+)$/)?.[1]);
  if (seq && formatDocNumber(seq, settings.numbering[type], fy) === manual) {
    await registerManualSeq(type, fy, seq);
    doc.seq = seq;
  }
  doc.number = manual;
  doc.fy = fy;
}

/** Total and latest date of the payments received before billing ("already paid"), for the note. */
export function paidSummary(paid) {
  if (!paid?.length) return null;
  const amount = paid.reduce((s, p) => s + p.amount + p.tds, 0);
  const date = paid.map((p) => new Date(p.date)).sort((a, b) => b - a)[0];
  return { amount, date, count: paid.length };
}

/** Payments received before billing can't add up to more than the invoice. Checked before anything is saved. */
function assertPayable(total, paid) {
  if (!paid) return;
  if (total <= 0) throw ApiError.badRequest('Nothing to pay', [{ path: 'items', message: 'The invoice total must be more than 0' }]);
  const received = paidSummary(paid).amount;
  if (received > total) {
    throw ApiError.badRequest('More than the invoice total', [{ path: 'paid', message: `Payments add up to ${(received / 100).toFixed(2)}, more than the total of ${(total / 100).toFixed(2)}` }]);
  }
}

export async function createInvoice(body) {
  const fields = await buildInvoiceFields(body);
  assertPayable(fields.total, body.paid);
  const doc = new Invoice({ ...fields, status: body.status === 'sent' || body.paid ? 'sent' : 'draft' });
  if (doc.status === 'sent') doc.sentAt = new Date();
  applyPaymentState(doc);
  await doc.validate(); // validate before consuming a number from the series
  // Drafts stay unnumbered unless a number was typed in; sent invoices get the next one.
  if (doc.status === 'sent' || body.number) await assignNumber(doc, body.number);
  return doc.save();
}

/** Draft → sent: assign the next number (if it has none) and record when it was sent. */
export async function finalizeInvoice(inv) {
  if (inv.status === 'cancelled') throw ApiError.conflict('This invoice is cancelled');
  if (!inv.number) await assignNumber(inv, null);
  if (inv.status === 'draft') {
    inv.status = 'sent';
    inv.sentAt = new Date();
    inv.$locals.auditAction = 'status';
  }
  applyPaymentState(inv);
  return inv.save();
}

export function assertEditable(inv) {
  if (inv.status === 'paid') throw ApiError.conflict('Paid invoices are locked and cannot be edited');
  if (inv.status === 'cancelled') throw ApiError.conflict('Cancelled invoices cannot be edited');
}

export async function updateInvoice(inv, body) {
  assertEditable(inv);
  const hasPayments = inv.amountPaid + inv.tdsAmount > 0;
  if (hasPayments && body.currency !== inv.currency) throw ApiError.conflict('Currency cannot change after a payment is recorded');
  const client = hasPayments || !body.newClient ? await Client.findById(body.client || inv.client) : undefined;
  if (hasPayments && String(client?._id) !== String(inv.client)) throw ApiError.conflict('Client cannot change after a payment is recorded');

  const fields = await buildInvoiceFields(body, { client, existing: inv });
  if (fields.total < inv.amountPaid + inv.tdsAmount) {
    throw ApiError.conflict('The new total is less than what has already been received');
  }
  if (body.paid && hasPayments) throw ApiError.conflict('This invoice already has payments. Record the rest from the invoice page.');
  assertPayable(fields.total, body.paid);
  inv.set(fields);
  if (!inv.number && body.number) await assignNumber(inv, body.number);
  applyPaymentState(inv);
  if ((body.status === 'sent' || body.paid) && inv.status === 'draft') return finalizeInvoice(inv);
  return inv.save();
}

/** Copy into a new draft with today's date and a new number. */
export async function duplicateInvoice(src) {
  const today = new Date();
  const body = {
    client: String(src.client),
    issueDate: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())),
    dueText: src.dueDate ? '' : src.dueText,
    dueDate: null,
    currency: src.currency,
    exchangeRate: src.exchangeRate,
    items: src.items.map((i) => ({ title: i.title, description: i.description, sac: i.sac, qty: i.qty, rate: i.rate })),
    discount: src.discount,
    gstEnabled: src.gst?.enabled,
    gstRate: src.gst?.rate,
    split: { type: src.split.type, advanceBy: src.split.advanceBy, advanceValue: src.split.advanceValue },
    bankAccount: src.bankAccount ? String(src.bankAccount) : null,
    note: src.note,
    noteIsCustom: src.noteIsCustom,
    terms: src.terms,
    handover: src.handover?.enabled ? { ...(src.handover.toObject?.() ?? src.handover), handoverDate: null, startDate: null } : { enabled: false },
  };
  return createInvoice(body);
}
