// Fields shared by invoices and quotes: client, line items, totals, split, notes,
// and the website handover terms.
import mongoose from 'mongoose';
import { CURRENCIES } from '@webx/shared/constants.js';
import { Money } from './common.js';

const { Schema } = mongoose;

export const itemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    sac: { type: String, trim: true, maxlength: 12 },
    qty: { type: Number, required: true, min: 0 },
    rate: Money({ required: true }),
    amount: Money({ required: true }),
  },
  { _id: false },
);

// Frozen copies printed on the document, so later edits to the client,
// company profile or bank account never change an issued invoice.
export const snapshotSchema = new Schema(
  {
    client: {
      name: String, secondaryName: String, contactPerson: String, email: String, phone: String, address: String, city: String,
      state: String, stateCode: String, pincode: String, country: String, gstin: String, pan: String, website: String,
      logo: { key: String, mimeType: String },
    },
    company: { name: String, tagline: String, address: String, state: String, stateCode: String, phones: [String], email: String, website: String, gstin: String, pan: String },
    bank: { label: String, payableTo: String, bankName: String, branch: String, accountNumber: String, ifsc: String, swift: String, upiId: String },
  },
  { _id: false },
);

// Website handover: free hosting / maintenance periods (start on the handover
// date, or on startDate when one is set) and what maintenance covers. Lists are copied from Settings when saved.
export const handoverSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    hostingMonths: { type: Number, enum: [0, 12, 24, 36], default: 0 },
    maintenanceMonths: { type: Number, enum: [0, 1, 3, 6, 12], default: 0 },
    handoverDate: Date,
    startDate: Date, // free periods start here instead of on the handover date
    includes: [{ type: String, trim: true, maxlength: 200 }],
    excludes: [{ type: String, trim: true, maxlength: 200 }],
  },
  { _id: false },
);

export function billingFields() {
  return {
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    snapshot: snapshotSchema,

    issueDate: { type: Date, required: true },
    dueText: { type: String, trim: true, maxlength: 80 },
    dueDate: Date,

    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    exchangeRate: { type: Number, default: 1, min: 0 },

    items: { type: [itemSchema], validate: [(v) => v.length > 0, 'Add at least one line item'] },
    discount: { type: { type: String, enum: ['percent', 'amount'], default: 'amount' }, value: { type: Number, default: 0, min: 0 } },
    discountAmount: Money(),
    subtotal: Money(),
    taxable: Money(),
    gst: {
      enabled: { type: Boolean, default: false },
      mode: { type: String, enum: ['intra', 'inter'], default: 'intra' },
      rate: { type: Number, default: 0 },
      cgst: Money(),
      sgst: Money(),
      igst: Money(),
      taxTotal: Money(),
    },
    total: Money(),
    totalInr: Money(),

    split: {
      type: { type: String, enum: ['full', 'advance'], default: 'full' },
      advanceBy: { type: String, enum: ['percent', 'amount'], default: 'percent' },
      advanceValue: { type: Number, default: 0 },
      advancePercent: Number,
      advanceAmount: Money(),
      balanceAmount: Money(),
    },

    bankAccount: { type: Schema.Types.ObjectId, ref: 'BankAccount' },
    note: { type: String, trim: true, maxlength: 2000 },
    terms: { type: String, trim: true, maxlength: 2000 },
    noteIsCustom: { type: Boolean, default: false },

    handover: { type: handoverSchema, default: () => ({}) },
  };
}
