import { z } from 'zod';
import mongoose from 'mongoose';

/** Optional trimmed string; empty string allowed (clears the field). */
export const optStr = (max = 200) => z.string().trim().max(max).optional().default('');

export const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

export const idParams = z.object({ id: objectId });

/** Integer amount in minor units (paise). */
export const minor = z.number().int('Amount must be in whole paise');

/** "YYYY-MM-DD" or ISO string → Date at UTC midnight of that day. */
export const businessDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'Use YYYY-MM-DD')
  .transform((v) => new Date(`${v.slice(0, 10)}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()), 'Invalid date');

export const fyLabelSchema = z.string().regex(/^\d{4}(-\d{2})?$/, 'Use a financial year like 2026-27');

export const IFSC_RX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_RX = /^[\w.-]{2,256}@[a-zA-Z][\w.-]{1,63}$/;
export const GSTIN_RX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RX = /^[A-Z]{5}\d{4}[A-Z]$/;

/** Optional string that must match `rx` when non-empty. */
export const optPattern = (rx, message, { upper = false } = {}) =>
  z
    .string()
    .trim()
    .transform((v) => (upper ? v.toUpperCase() : v))
    .refine((v) => v === '' || rx.test(v), message)
    .optional()
    .default('');
