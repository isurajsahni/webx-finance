import mongoose from 'mongoose';
import { CURRENCIES, PAYMENT_MODES } from '@webx/shared/constants.js';
import { Money, FileRefSchema, voidFields, actorPlugin } from './common.js';
import { auditPlugin } from '../plugins/audit.js';

const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    receiptNumber: { type: String, required: true, unique: true },
    seq: Number,
    fy: String,

    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    invoiceNumber: String,
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },

    date: { type: Date, required: true },
    amount: Money({ required: true }), // money actually received, in invoice currency
    tds: Money(), // tax deducted at source by the client, counts towards settling the invoice
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    exchangeRate: { type: Number, default: 1, min: 0 },
    amountInr: Money(),
    tdsInr: Money(),

    mode: { type: String, enum: PAYMENT_MODES, required: true },
    reference: { type: String, trim: true, maxlength: 80 },
    bankAccount: { type: Schema.Types.ObjectId, ref: 'BankAccount' },
    proof: { type: FileRefSchema, default: undefined },
    notes: { type: String, trim: true, maxlength: 1000 },

    // Frozen at the time of the payment so the receipt never changes.
    snapshot: {
      client: {
        name: String, secondaryName: String, address: String, city: String, state: String, pincode: String, country: String,
        phone: String, email: String, gstin: String, logo: { key: String, mimeType: String },
      },
      company: { name: String, tagline: String, address: String, phones: [String], email: String, website: String },
      bank: { kind: String, label: String, bankName: String, accountNumber: String },
      invoice: { number: String, total: Number, title: String, issueDate: Date },
    },
    // What this payment did to the invoice, printed on the receipt.
    purpose: { type: String, enum: ['advance', 'part', 'final'] },
    previouslyReceived: Money(),
    balanceAfter: Money(),

    status: { type: String, enum: ['active', 'void'], default: 'active', index: true },
    ...voidFields,
  },
  { timestamps: true },
);

paymentSchema.index({ date: -1 });

paymentSchema.plugin(actorPlugin);
paymentSchema.plugin(auditPlugin, { entity: 'Payment' });

export const Payment = mongoose.model('Payment', paymentSchema);
