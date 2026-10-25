import { z } from 'zod';
import { fileSafe } from '@webx/shared/numbering.js';
import { startOfUtcDay } from '@webx/shared/invoiceStatus.js';
import { renderInvoice } from '@webx/shared/templates/index.js';
import { Quote } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { objectId } from '../validators/common.js';
import { peekNumber } from '../services/numbering.js';
import * as svc from '../services/quotes.js';
import { sendDocumentPdf } from '../services/pdfResponse.js';

/** "expired" is derived: sent but past its valid-until date. */
const withStatus = (q) => ({ ...q, displayStatus: q.status === 'sent' && q.validUntil && new Date(q.validUntil) < startOfUtcDay() ? 'expired' : q.status });

async function load(id) {
  const q = await Quote.findById(id);
  if (!q) throw ApiError.notFound('Quote not found');
  return q;
}

const listQuery = z.object({ status: z.enum(['draft', 'sent', 'accepted', 'declined', 'converted', 'expired', 'open']).optional(), client: objectId.optional() });

export async function list(req, res) {
  const { status, client } = listQuery.parse(Object.fromEntries(Object.entries(req.query).filter(([, v]) => v !== '')));
  const filter = {};
  const today = startOfUtcDay();
  if (status === 'expired') Object.assign(filter, { status: 'sent', validUntil: { $lt: today } });
  else if (status === 'open') filter.status = { $in: ['draft', 'sent', 'accepted'] };
  else if (status) filter.status = status;
  if (client) filter.client = client;
  const page = await paginate(Quote, req, {
    filter,
    searchFields: ['number', 'snapshot.client.name', 'snapshot.client.secondaryName', 'items.title'],
    sortable: ['issueDate', 'total', 'createdAt'],
    defaultSort: '-issueDate -createdAt',
    select: '-snapshot.company -snapshot.bank -items.description',
  });
  page.items = page.items.map(withStatus);
  res.json(page);
}

export async function get(req, res) {
  const q = await Quote.findById(req.params.id).populate('bankAccount', 'label kind').lean();
  if (!q) throw ApiError.notFound('Quote not found');
  res.json({ quote: withStatus(q) });
}

export async function nextNumber(req, res) {
  const date = req.query.date ? new Date(`${String(req.query.date).slice(0, 10)}T00:00:00Z`) : new Date();
  res.json(await peekNumber('quote', date));
}

const done = (res, q, code = 200) => res.status(code).json({ quote: withStatus(q.toObject()) });
export const create = async (req, res) => done(res, await svc.createQuote(req.body), 201);
export const update = async (req, res) => done(res, await svc.updateQuote(await load(req.params.id), req.body));
export const send = async (req, res) => done(res, await svc.sendQuote(await load(req.params.id)));
export const accept = async (req, res) => done(res, await svc.acceptQuote(await load(req.params.id)));
export async function decline(req, res) {
  const { reason } = z.object({ reason: z.string().trim().max(500).default('') }).parse(req.body ?? {});
  done(res, await svc.declineQuote(await load(req.params.id), reason));
}
export const duplicate = async (req, res) => done(res, await svc.duplicateQuote(await load(req.params.id)), 201);
export async function convert(req, res) {
  const invoice = await svc.convertQuote(await load(req.params.id));
  res.status(201).json({ invoice: invoice.toObject() });
}

export async function pdf(req, res) {
  const q = (await load(req.params.id)).toObject();
  await sendDocumentPdf(req, res, {
    doc: { ...q, docType: 'quote' },
    render: renderInvoice,
    files: [q.snapshot?.client?.logo?.key],
    filename: `Quotation-${q.number ? fileSafe(q.number) : 'DRAFT'}-${fileSafe(q.snapshot?.client?.name || 'Client')}.pdf`,
  });
}
