import { z } from 'zod';
import { stateCodeFor, isIndia } from '@webx/shared/india.js';
import { Client } from '../models/index.js';
import { storeUpload } from '../services/storage/index.js';
import { clientStatement } from '../services/statement.js';
import { sendExport } from '../services/exporters.js';
import { formatLongDate } from '@webx/shared/fy.js';
import { formatMoney } from '@webx/shared/money.js';
import { businessDate } from '../validators/common.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { clientStats, emptyStats } from '../services/clientStats.js';

const listFilter = z.object({ archived: z.enum(['0', '1', 'all']).default('0') });

export async function listClients(req, res) {
  const { archived } = listFilter.parse(req.query);
  const filter = archived === 'all' ? {} : { isArchived: archived === '1' };
  const page = await paginate(Client, req, {
    filter,
    searchFields: ['name', 'secondaryName', 'contactPerson', 'email', 'phone', 'gstin'],
    sortable: ['name', 'createdAt'],
    defaultSort: 'name',
  });
  const stats = await clientStats(page.items.map((c) => c._id));
  page.items = page.items.map((c) => ({ ...c, stats: stats.get(String(c._id)) || emptyStats }));
  res.json(page);
}

export async function getClient(req, res) {
  const client = await Client.findById(req.params.id).lean();
  if (!client) throw ApiError.notFound('Client not found');
  const stats = await clientStats([client._id]);
  res.json({ client: { ...client, stats: stats.get(String(client._id)) || emptyStats } });
}

const withStateCode = (b) => ({ ...b, stateCode: isIndia(b.country) ? stateCodeFor(b.state) || b.gstin?.slice(0, 2) || '' : '' });

export async function createClient(req, res) {
  const client = await new Client(withStateCode(req.body)).save();
  res.status(201).json({ client });
}

export async function updateClient(req, res) {
  const client = await Client.findById(req.params.id);
  if (!client) throw ApiError.notFound('Client not found');
  client.set(withStateCode(req.body));
  await client.save();
  res.json({ client });
}

export async function uploadLogo(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose an SVG, PNG or JPG');
  const client = await Client.findById(req.params.id);
  if (!client) throw ApiError.notFound('Client not found');
  // The previous file is kept: invoices already issued still print it.
  client.logo = await storeUpload(req.file, 'client-logos');
  await client.save();
  res.json({ client });
}

export async function removeLogo(req, res) {
  const client = await Client.findById(req.params.id);
  if (!client) throw ApiError.notFound('Client not found');
  client.logo = undefined;
  await client.save(); // the file stays: issued invoices may still show it
  res.json({ client });
}

export async function setArchived(req, res) {
  const client = await Client.findById(req.params.id);
  if (!client) throw ApiError.notFound('Client not found');
  client.isArchived = req.path.endsWith('/archive');
  client.$locals.auditAction = client.isArchived ? 'archive' : 'unarchive';
  await client.save();
  res.json({ client });
}

const statementQuery = z.object({ from: businessDate.optional(), to: businessDate.optional(), format: z.enum(['json', 'csv', 'xlsx', 'pdf']).default('json') });

export async function statement(req, res) {
  const q = statementQuery.parse(req.query);
  const client = await Client.findById(req.params.id).lean();
  if (!client) throw ApiError.notFound('Client not found');
  const data = await clientStatement(client._id, q);
  if (q.format === 'json') return res.json({ client: { _id: client._id, name: client.name }, ...data });

  const period = q.from || q.to ? `${q.from ? formatLongDate(q.from) : 'Start'} – ${q.to ? formatLongDate(q.to) : formatLongDate(new Date())}` : 'All transactions';
  const rows = [{ date: q.from || null, type: '', ref: '', description: 'Opening balance', debit: null, credit: null, balance: data.opening }, ...data.rows];
  return sendExport(req, res, {
    title: 'Statement of Account',
    subtitle: `${client.name}${client.secondaryName ? ` (${client.secondaryName})` : ''} · ${period} · ${data.closing > 0 ? `Balance due ${formatMoney(data.closing)}` : data.closing < 0 ? `In credit ${formatMoney(-data.closing)}` : 'Fully settled'}`,
    sheets: [{
      name: 'Statement',
      columns: [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'type', label: 'Type', type: 'text' },
        { key: 'ref', label: 'Number', type: 'text', width: 18 },
        { key: 'description', label: 'Details', type: 'text', width: 34 },
        { key: 'debit', label: 'Invoiced', type: 'money' },
        { key: 'credit', label: 'Received', type: 'money' },
        { key: 'balance', label: 'Balance', type: 'money' },
      ],
      rows,
      total: { description: 'Closing balance', debit: data.totals.debit, credit: data.totals.credit, balance: data.closing },
    }],
  }, q.format, `Statement-${client.name}-${new Date().toISOString().slice(0, 10)}`);
}
