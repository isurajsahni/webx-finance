import mongoose from 'mongoose';
import { PAYMENT_MODES, REIMBURSEMENT_STATUSES, RECURRING_INTERVALS } from '@webx/shared/constants.js';
import { Money, FileRefSchema, voidFields, actorPlugin } from './common.js';
import { auditPlugin } from '../plugins/audit.js';

const { Schema } = mongoose;

const accountSnap = { kind: String, label: String, bankName: String, accountNumber: String };

// One model for company expenses and reimbursements (an expense someone paid
// personally). Reimbursements move submitted → approved → reimbursed.
const expenseSchema = new Schema(
  {
    voucherNumber: { type: String, unique: true, sparse: true }, // reimbursements get one when reimbursed
    seq: Number,
    fy: String,

    date: { type: Date, required: true },
    category: { type: Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true },
    categoryName: String,
    vendor: { type: String, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    lines: {
      type: [{ _id: false, description: { type: String, trim: true, maxlength: 200 }, amount: Money({ required: true }) }],
      validate: [(v) => v.length > 0, 'Add at least one line'],
    },
    amount: Money({ required: true }),

    mode: { type: String, enum: PAYMENT_MODES },
    reference: { type: String, trim: true, maxlength: 80 },
    paidFrom: { type: Schema.Types.ObjectId, ref: 'BankAccount' },
    bills: { type: [FileRefSchema], default: [] },
    client: { type: Schema.Types.ObjectId, ref: 'Client' },
    project: { type: String, trim: true, maxlength: 120 },

    recurring: {
      enabled: { type: Boolean, default: false },
      interval: { type: String, enum: RECURRING_INTERVALS },
      nextDueDate: Date,
    },
    recurringSource: { type: Schema.Types.ObjectId, ref: 'Expense' },

    isReimbursement: { type: Boolean, default: false, index: true },
    reimbursement: {
      payeeType: { type: String, enum: ['owner', 'member'] },
      member: { type: Schema.Types.ObjectId, ref: 'TeamMember' },
      payeeName: String,
      payeeRole: String,
      status: { type: String, enum: REIMBURSEMENT_STATUSES },
      approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      approvedAt: Date,
      rejectedReason: String,
      reimbursedAt: Date,
      reimbursedFrom: { type: Schema.Types.ObjectId, ref: 'BankAccount' },
      mode: { type: String, enum: PAYMENT_MODES },
      reference: String,
    },

    snapshot: {
      company: { name: String, tagline: String, address: String, phones: [String], email: String, website: String },
      paidFrom: accountSnap,
      reimbursedFrom: accountSnap,
      clientName: String,
    },

    status: { type: String, enum: ['active', 'void'], default: 'active', index: true },
    ...voidFields,
  },
  { timestamps: true },
);

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ 'reimbursement.status': 1 });
expenseSchema.index({ 'recurring.enabled': 1, 'recurring.nextDueDate': 1 });

expenseSchema.plugin(actorPlugin);
expenseSchema.plugin(auditPlugin, { entity: 'Expense' });

export const Expense = mongoose.model('Expense', expenseSchema);
