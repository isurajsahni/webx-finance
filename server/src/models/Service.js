import mongoose from 'mongoose';
import { Money, actorPlugin } from './common.js';
import { auditPlugin } from '../plugins/audit.js';

// Saved services: reusable line items (title, description, rate, SAC) for invoices and quotes.
const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    rate: Money(),
    unit: { type: String, trim: true, maxlength: 30 }, // e.g. "project", "page", "month"
    sac: { type: String, trim: true, maxlength: 12 },
    category: { type: String, trim: true, maxlength: 60 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

serviceSchema.index({ isActive: 1, name: 1 });
serviceSchema.plugin(actorPlugin);
serviceSchema.plugin(auditPlugin, { entity: 'Service' });

export const Service = mongoose.model('Service', serviceSchema);
