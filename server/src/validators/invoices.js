import { z } from 'zod';
import { CURRENCIES, PAYMENT_MODES } from '@webx/shared/constants.js';
import { objectId, optStr, minor, businessDate } from './common.js';
import { clientBody } from './clients.js';

const item = z.object({
  title: z.string().trim().min(1, 'Item title is required').max(200),
  description: optStr(1000),
  sac: optStr(12),
  qty: z.number().positive('Quantity must be more than 0').max(1_000_000).refine((q) => Math.round(q * 100) === q * 100, 'Up to 2 decimals'),
  rate: minor.min(0, 'Rate cannot be negative'),
});

export const handoverBody = z.object({
  enabled: z.boolean().default(false),
  hostingMonths: z.union([z.literal(0), z.literal(12), z.literal(24), z.literal(36)]).default(0),
  maintenanceMonths: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(6), z.literal(12)]).default(0),
  handoverDate: businessDate.optional().nullable(),
  startDate: businessDate.optional().nullable(),
  includes: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  excludes: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
});

/** "Already paid": money received before the bill was made, each with its own amount and date. */
export const paidBody = z
  .object({
    date: businessDate,
    amount: minor.min(0, 'Amount cannot be negative'),
    mode: z.enum(PAYMENT_MODES),
    reference: optStr(80),
    bankAccount: objectId.optional().nullable(),
    tds: minor.min(0, 'TDS cannot be negative').default(0),
    notes: optStr(1000),
  })
  .refine((v) => v.amount + v.tds > 0, { path: ['amount'], message: 'Enter the amount received' });

/** Shared by invoices and quotes. */
export const billingBody = z
  .object({
    client: objectId.optional(),
    newClient: clientBody.optional(),
    number: z.string().trim().max(40).regex(/^[A-Za-z0-9/_-]*$/, 'Letters, numbers, / _ - only').optional().default(''),
    issueDate: businessDate,
    dueText: optStr(80),
    dueDate: businessDate.optional().nullable(),
    currency: z.enum(CURRENCIES).default('INR'),
    exchangeRate: z.number().positive('Exchange rate must be more than 0').max(100000).default(1),
    items: z.array(item).min(1, 'Add at least one line item').max(200),
    discount: z.object({ type: z.enum(['percent', 'amount']), value: z.number().min(0) }).default({ type: 'amount', value: 0 }),
    gstEnabled: z.boolean().default(false),
    gstRate: z.number().min(0).max(28).optional(),
    split: z.object({
      type: z.enum(['full', 'advance']),
      advanceBy: z.enum(['percent', 'amount']).default('percent'),
      advanceValue: z.number().min(0).default(0),
    }),
    bankAccount: objectId.optional().nullable(),
    note: optStr(2000),
    noteIsCustom: z.boolean().default(false),
    terms: optStr(2000).optional(),
    handover: handoverBody.optional(),
    validUntil: businessDate.optional().nullable(), // quotes only
    paid: z.array(paidBody).min(1, 'Add the payment received').max(20).optional(), // invoices only
    status: z.enum(['draft', 'sent']).default('draft'),
  })
  .superRefine((v, ctx) => {
    if (!v.client && !v.newClient) ctx.addIssue({ code: 'custom', path: ['client'], message: 'Choose a client or add a new one' });
    if (v.discount.type === 'percent' && v.discount.value > 100) ctx.addIssue({ code: 'custom', path: ['discount', 'value'], message: 'Max 100%' });
    if (v.discount.type === 'amount' && !Number.isInteger(v.discount.value)) ctx.addIssue({ code: 'custom', path: ['discount', 'value'], message: 'Amount must be in whole paise' });
    if (v.split.type === 'advance') {
      if (v.split.advanceBy === 'percent' && (v.split.advanceValue <= 0 || v.split.advanceValue > 100)) {
        ctx.addIssue({ code: 'custom', path: ['split', 'advanceValue'], message: 'Advance must be between 0 and 100%' });
      }
      if (v.split.advanceBy === 'amount' && (!Number.isInteger(v.split.advanceValue) || v.split.advanceValue <= 0)) {
        ctx.addIssue({ code: 'custom', path: ['split', 'advanceValue'], message: 'Enter the advance amount' });
      }
    }
    if (v.currency === 'INR' && v.exchangeRate !== 1) v.exchangeRate = 1;
  });

export const invoiceBody = billingBody;

export const cancelBody = z.object({ reason: z.string().trim().min(3, 'Give a reason (min 3 characters)').max(500) });

export const listInvoicesQuery = z.object({
  status: z.enum(['draft', 'sent', 'partly_paid', 'paid', 'overdue', 'cancelled', 'unpaid', 'open']).optional(),
  client: objectId.optional(),
  from: businessDate.optional(),
  to: businessDate.optional(),
});
