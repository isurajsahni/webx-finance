import mongoose from 'mongoose';
import { Invoice } from '../models/index.js';

/** Billed / received / outstanding per client, in INR (drafts and cancelled excluded). */
export async function clientStats(clientIds) {
  const ids = clientIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const toInr = (field) => ({ $round: [{ $multiply: [field, '$exchangeRate'] }, 0] });
  const rows = await Invoice.aggregate([
    { $match: { client: { $in: ids }, status: { $nin: ['draft', 'cancelled'] } } },
    {
      $group: {
        _id: '$client',
        invoiceCount: { $sum: 1 },
        billedInr: { $sum: '$totalInr' },
        receivedInr: { $sum: toInr('$amountPaid') },
        tdsInr: { $sum: toInr('$tdsAmount') },
        outstandingInr: { $sum: toInr('$balanceDue') },
        lastInvoiceAt: { $max: '$issueDate' },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

export const emptyStats = { invoiceCount: 0, billedInr: 0, receivedInr: 0, tdsInr: 0, outstandingInr: 0, lastInvoiceAt: null };
