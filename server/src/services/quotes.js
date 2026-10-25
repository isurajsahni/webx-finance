// Quotations: same content and maths as invoices; accepted quotes convert into a draft invoice.
import { Quote, Settings } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { buildInvoiceFields, assignNumber, createInvoice } from './invoices.js';

const addDays = (date, days) => new Date(new Date(date).getTime() + days * 86400000);

async function quoteFields(body, existing) {
  const settings = await Settings.get();
  const { amountPaid, tdsAmount, ...fields } = await buildInvoiceFields(body, { existing }); // eslint-disable-line no-unused-vars
  const extra = settings.quoteDefaults?.note;
  // Automatic note on quotes = payment split + the quote's standard line from Settings.
  const note = fields.noteIsCustom || !extra ? fields.note : `${fields.note} ${extra}`;
  return { ...fields, note, validUntil: body.validUntil || addDays(body.issueDate, settings.quoteDefaults?.validityDays ?? 15) };
}

const numbering = { type: 'quote', Model: Quote };

export async function createQuote(body) {
  const doc = new Quote({ ...(await quoteFields(body)), status: body.status === 'sent' ? 'sent' : 'draft' });
  if (doc.status === 'sent') doc.sentAt = new Date();
  await doc.validate();
  if (doc.status === 'sent' || body.number) await assignNumber(doc, body.number, numbering);
  return doc.save();
}

export async function updateQuote(doc, body) {
  if (!['draft', 'sent'].includes(doc.status)) throw ApiError.conflict(`A ${doc.status} quote cannot be edited. Duplicate it to make a new version.`);
  doc.set(await quoteFields(body, doc));
  if (!doc.number && body.number) await assignNumber(doc, body.number, numbering);
  if (body.status === 'sent' && doc.status === 'draft') return sendQuote(doc);
  return doc.save();
}

export async function sendQuote(doc) {
  if (!['draft', 'sent'].includes(doc.status)) throw ApiError.conflict(`This quote is ${doc.status}`);
  if (!doc.number) await assignNumber(doc, null, numbering);
  if (doc.status === 'draft') {
    doc.status = 'sent';
    doc.sentAt = new Date();
    doc.$locals.auditAction = 'status';
  }
  return doc.save();
}

export async function acceptQuote(doc) {
  if (!['draft', 'sent'].includes(doc.status)) throw ApiError.conflict(`This quote is ${doc.status}`);
  if (!doc.number) await assignNumber(doc, null, numbering);
  Object.assign(doc, { status: 'accepted', acceptedAt: new Date() });
  doc.$locals.auditAction = 'status';
  return doc.save();
}

export async function declineQuote(doc, reason) {
  if (!['draft', 'sent', 'accepted'].includes(doc.status)) throw ApiError.conflict(`This quote is ${doc.status}`);
  Object.assign(doc, { status: 'declined', declinedAt: new Date(), declineReason: reason });
  doc.$locals.auditAction = 'status';
  return doc.save();
}

/** Accepted (or sent) quote → a new draft invoice with the same client, items, split and terms. */
export async function convertQuote(doc) {
  if (doc.status === 'converted') throw ApiError.conflict(`Already converted to invoice ${doc.invoiceNumber || ''}`.trim());
  if (doc.status === 'declined') throw ApiError.conflict('This quote was declined');
  if (!doc.number) await assignNumber(doc, null, numbering);
  const today = new Date();
  const invoice = await createInvoice({
    client: String(doc.client),
    issueDate: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())),
    dueText: '',
    currency: doc.currency,
    exchangeRate: doc.exchangeRate,
    items: doc.items.map((i) => ({ title: i.title, description: i.description, sac: i.sac, qty: i.qty, rate: i.rate })),
    discount: doc.discount,
    gstEnabled: doc.gst?.enabled,
    gstRate: doc.gst?.rate,
    split: { type: doc.split.type, advanceBy: doc.split.advanceBy, advanceValue: doc.split.advanceValue },
    bankAccount: doc.bankAccount ? String(doc.bankAccount) : null,
    note: doc.noteIsCustom ? doc.note : '',
    noteIsCustom: doc.noteIsCustom,
    terms: doc.terms,
    handover: doc.handover?.enabled ? { ...doc.handover.toObject(), handoverDate: null } : { enabled: false },
  });
  invoice.quote = doc._id;
  invoice.quoteNumber = doc.number;
  await invoice.save();
  Object.assign(doc, { status: 'converted', invoice: invoice._id, invoiceNumber: invoice.number || '', acceptedAt: doc.acceptedAt || new Date() });
  doc.$locals.auditAction = 'status';
  await doc.save();
  return invoice;
}

export async function duplicateQuote(src) {
  const today = new Date();
  return createQuote({
    client: String(src.client),
    issueDate: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())),
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
    handover: src.handover?.enabled ? src.handover.toObject() : { enabled: false },
  });
}
