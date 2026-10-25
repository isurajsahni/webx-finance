import mongoose from 'mongoose';
import { Money, actorPlugin } from './common.js';
import { auditPlugin } from '../plugins/audit.js';

const { Schema } = mongoose;

const bankAccountSchema = new Schema(
  {
    kind: { type: String, enum: ['bank', 'cash'], default: 'bank' },
    label: { type: String, required: true, trim: true, maxlength: 80 }, // "HDFC Current"
    payableTo: { type: String, trim: true }, // account holder name shown on PDFs
    bankName: { type: String, trim: true },
    branch: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifsc: { type: String, trim: true, uppercase: true },
    swift: { type: String, trim: true, uppercase: true },
    upiId: { type: String, trim: true },
    openingBalance: Money(),
    openingDate: Date,
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    // System accounts (e.g. "Cash in hand") cannot be deactivated.
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

bankAccountSchema.index({ isActive: 1, label: 1 });

bankAccountSchema.plugin(actorPlugin);
bankAccountSchema.plugin(auditPlugin, { entity: 'BankAccount' });

export const BankAccount = mongoose.model('BankAccount', bankAccountSchema);
