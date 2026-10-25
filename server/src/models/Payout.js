import mongoose from 'mongoose';
import { PAYMENT_MODES } from '@webx/shared/constants.js';
import { Money, voidFields, actorPlugin } from './common.js';
import { auditPlugin } from '../plugins/audit.js';

const { Schema } = mongoose;
const line = { _id: false, label: { type: String, trim: true, maxlength: 120 }, note: { type: String, trim: true, maxlength: 200 }, amount: Money({ required: true }) };

const payoutSchema = new Schema(
  {
    voucherNumber: { type: String, required: true, unique: true },
    seq: Number,
    fy: String,
    member: { type: Schema.Types.ObjectId, ref: 'TeamMember', required: true, index: true },
    date: { type: Date, required: true },
    periodLabel: { type: String, trim: true, maxlength: 60 }, // "September 2026"
    periodStart: Date,
    periodEnd: Date,
    project: { type: String, trim: true, maxlength: 120 },
    client: { type: Schema.Types.ObjectId, ref: 'Client' },

    earnings: { type: [line], validate: [(v) => v.length > 0, 'Add at least one earning'] },
    deductions: { type: [line], default: [] },
    bonus: Money(),
    gross: Money(),
    totalDeductions: Money(),
    net: Money(),

    mode: { type: String, enum: PAYMENT_MODES, required: true },
    reference: { type: String, trim: true, maxlength: 80 },
    paidFrom: { type: Schema.Types.ObjectId, ref: 'BankAccount' },
    notes: { type: String, trim: true, maxlength: 1000 },

    snapshot: {
      member: {
        name: String, role: String, type: { type: String }, email: String, phone: String,
        payoutDetails: { method: String, upiId: String, accountName: String, accountNumber: String, ifsc: String, bankName: String },
      },
      company: { name: String, tagline: String, address: String, phones: [String], email: String, website: String },
      paidFrom: { kind: String, label: String, bankName: String, accountNumber: String },
    },

    status: { type: String, enum: ['active', 'void'], default: 'active', index: true },
    ...voidFields,
  },
  { timestamps: true },
);

payoutSchema.index({ date: -1 });
payoutSchema.plugin(actorPlugin);
payoutSchema.plugin(auditPlugin, { entity: 'Payout' });

export const Payout = mongoose.model('Payout', payoutSchema);
