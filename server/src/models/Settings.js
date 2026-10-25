import mongoose from 'mongoose';
import { DEFAULT_NUMBERING } from '@webx/shared/numbering.js';
import { DEFAULT_MAINTENANCE_INCLUDES, DEFAULT_MAINTENANCE_EXCLUDES } from '@webx/shared/handover.js';
import { FileRefSchema, actorPlugin } from './common.js';
import { auditPlugin } from '../plugins/audit.js';

const { Schema } = mongoose;

const numberingSchema = (defaults) =>
  new Schema(
    {
      prefix: { type: String, default: defaults.prefix, trim: true, maxlength: 20 },
      padding: { type: Number, default: defaults.padding, min: 1, max: 8 },
      includeFy: { type: Boolean, default: defaults.includeFy },
      separator: { type: String, default: defaults.separator, maxlength: 3 },
    },
    { _id: false },
  );

const settingsSchema = new Schema(
  {
    key: { type: String, default: 'default', unique: true },
    company: {
      name: { type: String, default: 'The Web{X} Studio', trim: true },
      tagline: { type: String, default: 'Web Design · Development · Graphic & UI/UX Design', trim: true },
      address: { type: String, default: 'Model Town, Ludhiana, Punjab, India', trim: true },
      state: { type: String, default: 'Punjab', trim: true },
      stateCode: { type: String, default: '03', trim: true },
      country: { type: String, default: 'India', trim: true },
      phones: { type: [String], default: ['+91 79733 86875', '+91 97806 51142'] },
      email: { type: String, default: 'hello@thewebxstudio.com', trim: true, lowercase: true },
      website: { type: String, default: 'thewebxstudio.com', trim: true },
      gstin: { type: String, trim: true, uppercase: true },
      pan: { type: String, trim: true, uppercase: true },
      logo: { type: FileRefSchema, default: undefined },
      signature: { type: FileRefSchema, default: undefined }, // authorised signatory, printed on invoices
    },
    baseCurrency: { type: String, default: 'INR' },
    fyStartMonth: { type: Number, default: 4, min: 1, max: 12 },
    numbering: {
      invoice: { type: numberingSchema(DEFAULT_NUMBERING.invoice), default: () => ({}) },
      quote: { type: numberingSchema(DEFAULT_NUMBERING.quote), default: () => ({}) },
      receipt: { type: numberingSchema(DEFAULT_NUMBERING.receipt), default: () => ({}) },
      payslip: { type: numberingSchema(DEFAULT_NUMBERING.payslip), default: () => ({}) },
      voucher: { type: numberingSchema(DEFAULT_NUMBERING.voucher), default: () => ({}) },
    },
    handoverDefaults: {
      enabledByDefault: { type: Boolean, default: false },
      hostingMonths: { type: Number, enum: [0, 12, 24, 36], default: 12 },
      maintenanceMonths: { type: Number, enum: [0, 1, 3, 6, 12], default: 3 },
      includes: { type: [String], default: () => [...DEFAULT_MAINTENANCE_INCLUDES] },
      excludes: { type: [String], default: () => [...DEFAULT_MAINTENANCE_EXCLUDES] },
    },
    quoteDefaults: {
      validityDays: { type: Number, default: 15, min: 1, max: 365 },
      note: { type: String, trim: true, default: 'Prices are valid until the date above. Work starts once the quote is accepted and the advance is received.' },
    },
    gst: {
      enabled: { type: Boolean, default: false },
      defaultRate: { type: Number, default: 18, min: 0, max: 28 },
    },
    invoiceDefaults: {
      advancePercent: { type: Number, default: 30, min: 0, max: 100 },
      dueText: { type: String, default: 'On receipt (advance)', trim: true },
      note: { type: String, default: '', trim: true },
      thankYouText: { type: String, default: 'Thank you for your business!', trim: true },
      footerText: { type: String, default: 'The Web{X} Studio · thewebxstudio.com · +91 97806 51142', trim: true },
      terms: {
        type: String,
        trim: true,
        default: 'Work begins once the advance is received.\nFinal files and website go-live are released after the balance is paid.\nPrices exclude third-party costs (domain, hosting, paid plugins) unless listed above.',
      },
      showSignature: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

settingsSchema.plugin(actorPlugin);
settingsSchema.plugin(auditPlugin, { entity: 'Settings' });

/** Load the single settings document, creating it with defaults on first use. */
settingsSchema.statics.get = async function () {
  const existing = await this.findOne({ key: 'default' });
  if (existing) return existing;
  try {
    return await this.create({ key: 'default' });
  } catch (err) {
    if (err?.code === 11000) return this.findOne({ key: 'default' });
    throw err;
  }
};

export const Settings = mongoose.model('Settings', settingsSchema);
