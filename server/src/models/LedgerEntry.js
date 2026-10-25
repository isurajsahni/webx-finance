import mongoose from 'mongoose';
import { Money, voidFields, actorPlugin } from './common.js';
import { auditPlugin } from '../plugins/audit.js';

const { Schema } = mongoose;

export const MANUAL_TYPES = ['owner_investment', 'owner_withdrawal', 'transfer', 'adjustment_in', 'adjustment_out'];

// Manual money movements that are not invoices, payouts or expenses.
// Everything else in the ledger is derived from those records directly.
const ledgerEntrySchema = new Schema(
  {
    type: { type: String, enum: MANUAL_TYPES, required: true },
    date: { type: Date, required: true },
    amount: Money({ required: true }),
    account: { type: Schema.Types.ObjectId, ref: 'BankAccount', required: true },
    toAccount: { type: Schema.Types.ObjectId, ref: 'BankAccount' }, // transfers only
    description: { type: String, trim: true, maxlength: 300 },
    reference: { type: String, trim: true, maxlength: 80 },
    status: { type: String, enum: ['active', 'void'], default: 'active' },
    ...voidFields,
  },
  { timestamps: true },
);

ledgerEntrySchema.index({ date: -1 });
ledgerEntrySchema.plugin(actorPlugin);
ledgerEntrySchema.plugin(auditPlugin, { entity: 'LedgerEntry' });

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
