import mongoose from 'mongoose';
import { fileSafe } from '@webx/shared/numbering.js';
import { renderReceipt } from '@webx/shared/templates/index.js';
import { Payment, Settings } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { storage, storeUpload } from '../services/storage/index.js';
import { recordPayment, voidPayment } from '../services/payments.js';
import { renderPdf } from '../services/pdf.js';
import { documentAssets, footerFontCss } from '../services/documentAssets.js';

function filterFrom(q) {
  const filter = {};
  // ObjectIds, not strings: the same filter is used in an aggregation (no auto-casting there).
  if (q.invoice) filter.invoice = new mongoose.Types.ObjectId(q.invoice);
  if (q.client) filter.client = new mongoose.Types.ObjectId(q.client);
  if (q.mode) filter.mode = q.mode;
  if (q.status) filter.status = q.status;
  if (q.from || q.to) filter.date = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  return filter;
}

export async function listPayments(req, res) {
  const filter = filterFrom(req.validatedQuery);
  const page = await paginate(Payment, req, {
    filter,
    searchFields: ['receiptNumber', 'invoiceNumber', 'reference', 'snapshot.client.name'],
    sortable: ['date', 'amount', 'createdAt'],
    defaultSort: '-date -createdAt',
    populate: { path: 'bankAccount', select: 'label kind' },
  });
  const [summary] = await Payment.aggregate([
    { $match: { ...filter, status: filter.status || 'active' } },
    { $group: { _id: null, count: { $sum: 1 }, amountInr: { $sum: '$amountInr' }, tdsInr: { $sum: '$tdsInr' } } },
  ]);
  res.json({ ...page, summary: summary || { count: 0, amountInr: 0, tdsInr: 0 } });
}

export async function getPayment(req, res) {
  const payment = await Payment.findById(req.params.id).populate('bankAccount', 'label kind').lean();
  if (!payment) throw ApiError.notFound('Payment not found');
  res.json({ payment });
}

export async function create(req, res) {
  const proof = req.file ? await storeUpload(req.file, 'payment-proofs') : undefined;
  try {
    const { payment, invoice } = await recordPayment(req.body, proof);
    res.status(201).json({ payment, invoice: { _id: invoice._id, status: invoice.status, amountPaid: invoice.amountPaid, tdsAmount: invoice.tdsAmount, balanceDue: invoice.balanceDue } });
  } catch (err) {
    if (proof) await storage.remove(proof.key).catch(() => {});
    throw err;
  }
}

export async function uploadProof(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose an image or PDF');
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound('Payment not found');
  const previous = payment.proof?.key;
  payment.proof = await storeUpload(req.file, 'payment-proofs');
  await payment.save();
  if (previous) await storage.remove(previous).catch(() => {});
  res.json({ payment });
}

export async function voidOne(req, res) {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound('Payment not found');
  const result = await voidPayment(payment, req.body.reason, req.user);
  res.json(result);
}

export function receiptFilename(p) {
  return `Receipt-${fileSafe(p.receiptNumber)}-${fileSafe(p.snapshot?.client?.name || 'Client')}.pdf`;
}

export async function receiptPdf(req, res) {
  const payment = await Payment.findById(req.params.id).lean();
  if (!payment) throw ApiError.notFound('Payment not found');
  const settings = (await Settings.get()).toObject();
  const [assets, footerFont] = await Promise.all([documentAssets(settings, { files: [payment.snapshot?.client?.logo?.key] }), footerFontCss()]);
  const buffer = await renderPdf(renderReceipt(payment, { settings, assets }), { footerText: settings.invoiceDefaults.footerText, footerFontCss: footerFont });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': buffer.length,
    'Content-Disposition': `${req.query.download ? 'attachment' : 'inline'}; filename="${receiptFilename(payment)}"`,
    'Cache-Control': 'private, no-store',
  });
  res.end(buffer);
}
