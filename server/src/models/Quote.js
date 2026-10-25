import mongoose from 'mongoose';
import { actorPlugin } from './common.js';
import { billingFields } from './billingFields.js';
import { auditPlugin } from '../plugins/audit.js';

const { Schema } = mongoose;

// A quotation: same content as an invoice, converted into one when accepted.
const quoteSchema = new Schema(
  {
    number: { type: String, trim: true, unique: true, sparse: true },
    seq: Number,
    fy: String,
    ...billingFields(),
    validUntil: Date,
    status: { type: String, enum: ['draft', 'sent', 'accepted', 'declined', 'converted'], default: 'draft', index: true },
    sentAt: Date,
    acceptedAt: Date,
    declinedAt: Date,
    declineReason: { type: String, trim: true, maxlength: 500 },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    invoiceNumber: String,
  },
  { timestamps: true },
);

quoteSchema.index({ issueDate: -1 });
quoteSchema.plugin(actorPlugin);
quoteSchema.plugin(auditPlugin, { entity: 'Quote' });

export const Quote = mongoose.model('Quote', quoteSchema);
