import mongoose from 'mongoose';
import { actorPlugin } from './common.js';
import { auditPlugin } from '../plugins/audit.js';

const expenseCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

expenseCategorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

expenseCategorySchema.plugin(actorPlugin);
expenseCategorySchema.plugin(auditPlugin, { entity: 'ExpenseCategory' });

export const ExpenseCategory = mongoose.model('ExpenseCategory', expenseCategorySchema);
