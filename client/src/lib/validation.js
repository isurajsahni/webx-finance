import { z } from 'zod';
import { toMinor } from '@webx/shared/money.js';

export const passwordRule = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number');

export const IFSC_RX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_RX = /^[\w.-]{2,256}@[a-zA-Z][\w.-]{1,63}$/;
export const GSTIN_RX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RX = /^[A-Z]{5}\d{4}[A-Z]$/;

/** Optional text that must match a pattern when filled (uppercased first). */
export const optUpperPattern = (rx, message) =>
  z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === '' || rx.test(v), message);

export const optPattern = (rx, message) => z.string().trim().refine((v) => v === '' || rx.test(v), message);

/** Money typed by a person ("1,50,000") → validated string; convert with toMinor on submit. */
export const moneyString = ({ allowNegative = false } = {}) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || toMinor(v) !== null, 'Enter a valid amount')
    .refine((v) => allowNegative || v === '' || toMinor(v) >= 0, 'Amount cannot be negative');
