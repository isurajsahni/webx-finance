// Document numbers, e.g. "2026-27/0001" or "RCPT-2026-27/0001".
import { fyLabel } from './fy.js';

export const DEFAULT_NUMBERING = {
  invoice: { prefix: '', padding: 4, includeFy: true, separator: '/' },
  quote: { prefix: 'QT-', padding: 4, includeFy: true, separator: '/' },
  receipt: { prefix: 'RCPT-', padding: 4, includeFy: true, separator: '/' },
  payslip: { prefix: 'PAY-', padding: 4, includeFy: true, separator: '/' },
  voucher: { prefix: 'VCH-', padding: 4, includeFy: true, separator: '/' },
};

/**
 * Key of the counter row for a series. With the FY in the number, each year
 * restarts at 0001 ("invoice:2026-27"). Without it the series never restarts
 * ("invoice:all"), otherwise next April would produce "0001" again.
 */
export function counterKey(type, fy, includeFy = true) {
  return includeFy ? `${type}:${fy}` : `${type}:all`;
}

export function formatDocNumber(seq, config, fy) {
  const { prefix = '', padding = 4, includeFy = true, separator = '/' } = config || {};
  const body = String(seq).padStart(padding, '0');
  return `${prefix}${includeFy ? `${fy}${separator}` : ''}${body}`;
}

export function docNumberFor(seq, config, date, fyStartMonth = 4) {
  return formatDocNumber(seq, config, fyLabel(date, fyStartMonth));
}

/** Make a document number safe for filenames ("2026-27/0903" → "2026-27-0903"). */
export function fileSafe(str) {
  return String(str)
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
