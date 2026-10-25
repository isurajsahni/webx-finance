import mongoose from 'mongoose';
import { CURRENCIES } from '@webx/shared/constants.js';
import { FileRefSchema, actorPlugin } from './common.js';
import { auditPlugin } from '../plugins/audit.js';

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    secondaryName: { type: String, trim: true, maxlength: 160 },
    contactPerson: { type: String, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 30 },
    address: { type: String, trim: true, maxlength: 400 }, // street / building lines
    city: { type: String, trim: true, maxlength: 80 },
    state: { type: String, trim: true, maxlength: 60 },
    stateCode: { type: String, trim: true, maxlength: 2 }, // GST state code, derived from state
    pincode: { type: String, trim: true, maxlength: 12 },
    pan: { type: String, trim: true, uppercase: true },
    website: { type: String, trim: true, maxlength: 160 },
    logo: { type: FileRefSchema, default: undefined },
    country: { type: String, trim: true, default: 'India', maxlength: 60 },
    gstin: { type: String, trim: true, uppercase: true },
    defaultCurrency: { type: String, enum: CURRENCIES, default: 'INR' },
    notes: { type: String, trim: true, maxlength: 2000 },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

clientSchema.index({ isArchived: 1, name: 1 });

clientSchema.plugin(actorPlugin);
clientSchema.plugin(auditPlugin, { entity: 'Client' });

export const Client = mongoose.model('Client', clientSchema);
