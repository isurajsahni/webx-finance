import mongoose from 'mongoose';
import { Money, actorPlugin } from './common.js';
import { billingFields } from './billingFields.js';
import { auditPlugin } from '../plugins/audit.js';

const { Schema } = mongoose;

const invoiceSchema = new Schema(
  {
    // Assigned when the invoice is finalised (sent / first payment). Drafts have none,
    // so discarded drafts never leave gaps in the series.
    number: { type: String, trim: true, unique: true, sparse: true },
    seq: Number,
    fy: { type: String, index: true },
    kind: { type: String, enum: ['standard', 'balance'], default: 'standard' },
    parentInvoice: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    parentNumber: String,
    quote: { type: Schema.Types.ObjectId, ref: 'Quote' }, // the accepted quote this came from
    quoteNumber: String,

    ...billingFields(),

    status: { type: String, enum: ['draft', 'sent', 'partly_paid', 'paid', 'cancelled'], default: 'draft', index: true },
    amountPaid: Money(),
    tdsAmount: Money(),
    balanceDue: Money(),
    sentAt: Date,
    cancelReason: { type: String, trim: true },
    cancelledAt: Date,
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

invoiceSchema.index({ issueDate: -1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ 'snapshot.client.name': 1 });

invoiceSchema.plugin(actorPlugin);
invoiceSchema.plugin(auditPlugin, { entity: 'Invoice' });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
