import { z } from 'zod';
import { PAYMENT_MODES } from '@webx/shared/constants.js';
import { objectId, optStr, minor, businessDate } from './common.js';

export const paymentBody = z
  .object({
    invoice: objectId,
    date: businessDate,
    amount: minor.min(0, 'Amount cannot be negative'),
    tds: minor.min(0, 'TDS cannot be negative').default(0),
    mode: z.enum(PAYMENT_MODES),
    reference: optStr(80),
    bankAccount: objectId.optional().nullable(),
    exchangeRate: z.number().positive().max(100000).optional(),
    notes: optStr(1000),
  })
  .refine((v) => v.amount + v.tds > 0, { path: ['amount'], message: 'Enter the amount received' });

export const voidBody = z.object({ reason: z.string().trim().min(3, 'Give a reason (min 3 characters)').max(500) });

export const listPaymentsQuery = z.object({
  invoice: objectId.optional(),
  client: objectId.optional(),
  mode: z.enum(PAYMENT_MODES).optional(),
  status: z.enum(['active', 'void']).optional(),
  from: businessDate.optional(),
  to: businessDate.optional(),
});
