// All money is stored as integers in the smallest unit (paise, cents, fils).
// Every currency we support has 2 decimal places.
import { CURRENCY_SYMBOLS } from './constants.js';

const MINOR_DIGITS = 2;

/**
 * Parse user input ("1,50,000.5", 150000.5, "₹ 12") into minor units without
 * going through floating point multiplication. Returns null for empty/invalid.
 */
export function toMinor(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    value = value.toFixed(MINOR_DIGITS);
  }
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  if (!/^-?\d*(\.\d*)?$/.test(cleaned) || cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const negative = cleaned.startsWith('-');
  const [whole = '0', frac = ''] = cleaned.replace('-', '').split('.');
  // Round half up on the third decimal.
  const padded = (frac + '000').slice(0, MINOR_DIGITS + 1);
  let minor = Number(whole || '0') * 100 + Number(padded.slice(0, MINOR_DIGITS));
  if (Number(padded[MINOR_DIGITS]) >= 5) minor += 1;
  return negative ? -minor : minor;
}

/** Minor units → plain decimal string, e.g. 1500050 → "15000.50". */
export function fromMinor(minor) {
  if (minor === null || minor === undefined) return '';
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const str = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return negative ? `-${str}` : str;
}

/** Minor units → number in major units, for inputs and charts. */
export function minorToNumber(minor) {
  return (minor || 0) / 100;
}

/**
 * Format with grouping. INR uses Indian grouping (1,50,000.00).
 * `decimals: 'auto'` drops ".00" for whole amounts.
 */
export function formatAmount(minor, currency = 'INR', { decimals = 'auto' } = {}) {
  const value = (minor || 0) / 100;
  const showDecimals = decimals === 'auto' ? Math.abs(minor || 0) % 100 !== 0 : decimals;
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(value);
}

export function currencySymbol(currency = 'INR') {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
}

/** "₹1,50,000" / "-₹500.50" */
export function formatMoney(minor, currency = 'INR', opts) {
  const sign = (minor || 0) < 0 ? '-' : '';
  return `${sign}${currencySymbol(currency)}${formatAmount(Math.abs(minor || 0), currency, opts)}`;
}

/** Percentage of an amount in minor units, rounded to the nearest unit. */
export function percentOf(minor, percent) {
  return Math.round((minor * percent) / 100);
}
