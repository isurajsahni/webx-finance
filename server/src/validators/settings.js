import { z } from 'zod';
import { CURRENCIES, DOC_TYPES } from '@webx/shared/constants.js';
import { optStr, optPattern, minor, businessDate, fyLabelSchema, IFSC_RX, UPI_RX, GSTIN_RX, PAN_RX } from './common.js';

export const companyBody = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(100),
  tagline: optStr(150),
  address: optStr(300),
  state: optStr(60),
  stateCode: optPattern(/^\d{2}$/, 'State code is 2 digits, e.g. 03'),
  country: optStr(60),
  phones: z.array(z.string().trim().min(5).max(25)).max(5).default([]),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'))]).default(''),
  website: optStr(120),
  gstin: optPattern(GSTIN_RX, 'Invalid GSTIN', { upper: true }),
  pan: optPattern(PAN_RX, 'Invalid PAN', { upper: true }),
});

const numberingConfig = z.object({
  prefix: z.string().trim().max(20).regex(/^[A-Za-z0-9/_-]*$/, 'Letters, numbers, / _ - only').default(''),
  padding: z.number().int().min(1).max(8),
  includeFy: z.boolean(),
  separator: z.enum(['/', '-', '']),
});

export const numberingBody = z.object(Object.fromEntries(DOC_TYPES.map((t) => [t, numberingConfig])));

export const setNextNumberBody = z.object({
  type: z.enum(DOC_TYPES),
  fy: fyLabelSchema,
  next: z.number().int().min(1).max(99_999_999),
});

const lines = z.array(z.string().trim().min(1).max(200)).max(20);

export const handoverDefaultsBody = z.object({
  enabledByDefault: z.boolean(),
  hostingMonths: z.union([z.literal(0), z.literal(12), z.literal(24), z.literal(36)]),
  maintenanceMonths: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
  includes: lines,
  excludes: lines,
});

export const quoteDefaultsBody = z.object({
  validityDays: z.number().int().min(1).max(365),
  note: optStr(1000),
});

export const preferencesBody = z.object({
  baseCurrency: z.enum(CURRENCIES).default('INR'),
  gst: z.object({
    enabled: z.boolean(),
    defaultRate: z.number().min(0).max(28),
  }),
  handoverDefaults: handoverDefaultsBody.optional(),
  quoteDefaults: quoteDefaultsBody.optional(),
  invoiceDefaults: z.object({
    advancePercent: z.number().min(0).max(100),
    dueText: optStr(80),
    note: optStr(1000),
    thankYouText: optStr(120),
    footerText: optStr(200),
    terms: optStr(2000),
    showSignature: z.boolean().default(true),
  }),
});

export const bankAccountBody = z
  .object({
    kind: z.enum(['bank', 'cash']).default('bank'),
    label: z.string().trim().min(1, 'Label is required').max(80),
    payableTo: optStr(100),
    bankName: optStr(100),
    branch: optStr(100),
    accountNumber: optPattern(/^[0-9A-Z]{6,20}$/, 'Account number should be 6–20 letters/digits', { upper: true }),
    ifsc: optPattern(IFSC_RX, 'Invalid IFSC (e.g. HDFC0001234)', { upper: true }),
    swift: optPattern(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'Invalid SWIFT code', { upper: true }),
    upiId: optPattern(UPI_RX, 'Invalid UPI ID (e.g. name@okhdfcbank)'),
    openingBalance: minor.default(0),
    openingDate: businessDate.optional().nullable(),
    isDefault: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'bank' && !v.bankName && !v.upiId) {
      ctx.addIssue({ code: 'custom', path: ['bankName'], message: 'Add a bank name or a UPI ID' });
    }
  });

export const categoryBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});
