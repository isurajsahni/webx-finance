import { z } from 'zod';
import { CURRENCIES } from '@webx/shared/constants.js';
import { isIndia } from '@webx/shared/india.js';
import { optStr, optPattern, GSTIN_RX, PAN_RX } from './common.js';

export const clientBody = z
  .object({
  name: z.string().trim().min(1, 'Client name is required').max(120),
  secondaryName: optStr(160),
  contactPerson: optStr(120),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'))]).default(''),
  phone: optStr(30),
  address: optStr(400),
  city: optStr(80),
  state: optStr(60),
  pincode: optStr(12),
  country: optStr(60),
  gstin: optPattern(GSTIN_RX, 'Invalid GSTIN', { upper: true }),
  pan: optPattern(PAN_RX, 'Invalid PAN', { upper: true }),
  website: optStr(160),
  defaultCurrency: z.enum(CURRENCIES).default('INR'),
  notes: optStr(2000),
})
  .superRefine((v, ctx) => {
    if (isIndia(v.country) && v.pincode && !/^\d{6}$/.test(v.pincode)) ctx.addIssue({ code: 'custom', path: ['pincode'], message: 'PIN code is 6 digits' });
  });
