import { fileSafe } from '@webx/shared/numbering.js';
import { effectiveStatus, startOfUtcDay } from '@webx/shared/invoiceStatus.js';
import { renderInvoice } from '@webx/shared/templates/index.js';
import { Invoice, Payment, Settings } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { peekNumber } from '../services/numbering.js';
import { createInvoice, updateInvoice, duplicateInvoice, finalizeInvoice, handoverFields } from '../services/invoices.js';
import { recordPastPayments } from '../services/payments.js';
import { renderPdf } from '../services/pdf.js';
import { documentAssets, footerFontCss } from '../services/documentAssets.js';

const withStatus = (inv) => ({ ...inv, displayStatus: effectiveStatus(inv) });

async function load(id) {
  const inv = await Invoice.findById(id);
  if (!inv) throw ApiError.notFound('Invoice not found');
  return inv;
}

export async function listInvoices(req, res) {
  const { status, client, from, to } = req.validatedQuery;
  const filter = {};
  const today = startOfUtcDay();
  if (status === 'overdue') Object.assign(filter, { status: { $in: ['sent', 'partly_paid'] }, dueDate: { $lt: today }, balanceDue: { $gt: 0 } });
  else if (status === 'unpaid') filter.status = { $in: ['sent', 'partly_paid'] };
  else if (status === 'open') filter.status = { $in: ['draft', 'sent', 'partly_paid'] }; // can still receive payments
  else if (status === 'sent') Object.assign(filter, { status: 'sent', $or: [{ dueDate: null }, { dueDate: { $gte: today } }] });
  else if (status === 'partly_paid') Object.assign(filter, { status: 'partly_paid', $or: [{ dueDate: null }, { dueDate: { $gte: today } }] });
  else if (status) filter.status = status;
  if (client) filter.client = client;
  if (from || to) filter.issueDate = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

  const page = await paginate(Invoice, req, {
    filter,
    searchFields: ['number', 'snapshot.client.name', 'snapshot.client.secondaryName', 'items.title'],
    sortable: ['issueDate', 'number', 'total', 'createdAt'],
    defaultSort: '-issueDate -createdAt',
    select: '-snapshot.company -snapshot.bank -items.description',
  });
  page.items = page.items.map(withStatus);
  res.json(page);
}

export async function nextNumber(req, res) {
  const date = req.query.date ? new Date(`${String(req.query.date).slice(0, 10)}T00:00:00Z`) : new Date();
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('Invalid date');
  res.json(await peekNumber('invoice', date));
}

export async function getInvoice(req, res) {
  const inv = await Invoice.findById(req.params.id).populate('bankAccount', 'label kind').lean();
  if (!inv) throw ApiError.notFound('Invoice not found');
  res.json({ invoice: withStatus(inv) });
}

/** Save, then (for an "already paid" invoice) record the payments received before billing. */
async function saveAndSettle(req, res, save, status) {
  let inv = await save();
  let payments;
  if (req.body.paid) ({ payments, invoice: inv } = await recordPastPayments(inv, req.body.paid));
  res.status(status).json({ invoice: withStatus(inv.toObject()), ...(payments && { payments }) });
}

export async function create(req, res) {
  await saveAndSettle(req, res, () => createInvoice(req.body), 201);
}

export async function update(req, res) {
  await saveAndSettle(req, res, async () => updateInvoice(await load(req.params.id), req.body), 200);
}

export async function markSent(req, res) {
  const inv = await load(req.params.id);
  if (inv.status !== 'draft') throw ApiError.conflict('Only draft invoices can be marked as sent');
  await finalizeInvoice(inv);
  res.json({ invoice: withStatus(inv.toObject()) });
}

export async function duplicate(req, res) {
  const inv = await duplicateInvoice(await load(req.params.id));
  res.status(201).json({ invoice: withStatus(inv.toObject()) });
}

export async function cancel(req, res) {
  const inv = await load(req.params.id);
  if (inv.status === 'cancelled') throw ApiError.conflict('Invoice is already cancelled');
  if (inv.amountPaid + inv.tdsAmount > 0) throw ApiError.conflict('This invoice has payments. Void the payments first.');
  inv.status = 'cancelled';
  inv.cancelReason = req.body.reason;
  inv.cancelledAt = new Date();
  inv.cancelledBy = req.user._id;
  inv.$locals.auditAction = 'void';
  await inv.save();
  res.json({ invoice: withStatus(inv.toObject()) });
}

/** Active payments on an invoice, oldest first, as printed on the invoice. */
export function invoicePayments(invoiceId) {
  return Payment.find({ invoice: invoiceId, status: 'active' }).sort({ date: 1, createdAt: 1 }).select('date receiptNumber amount tds mode purpose').lean();
}

export function pdfFilename(inv) {
  const client = inv.snapshot?.client?.name || 'Client';
  return `Invoice-${inv.number ? fileSafe(inv.number) : 'DRAFT'}-${fileSafe(client)}.pdf`;
}

export async function pdf(req, res) {
  const inv = (await load(req.params.id)).toObject();
  inv.payments = await invoicePayments(inv._id);
  const settings = (await Settings.get()).toObject();
  const [assets, footerFont] = await Promise.all([documentAssets(settings, { files: [inv.snapshot?.client?.logo?.key] }), footerFontCss()]);
  const html = renderInvoice(inv, { settings, assets });
  const buffer = await renderPdf(html, { footerText: settings.invoiceDefaults.footerText, footerFontCss: footerFont });
  const name = pdfFilename(inv);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': buffer.length,
    'Content-Disposition': `${req.query.download ? 'attachment' : 'inline'}; filename="${name}"`,
    'Cache-Control': 'private, no-store',
  });
  res.end(buffer);
}

/** Handover terms can be set even on paid invoices: the handover usually happens after the final payment. */
export async function updateHandover(req, res) {
  const inv = await load(req.params.id);
  if (inv.status === 'cancelled') throw ApiError.conflict('This invoice is cancelled');
  inv.handover = handoverFields(req.body, inv.handover?.toObject?.(), await Settings.get());
  inv.$locals.auditAction = 'handover';
  await inv.save();
  res.json({ invoice: withStatus(inv.toObject()) });
}
