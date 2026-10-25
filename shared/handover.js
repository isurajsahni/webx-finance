// Website handover terms: free hosting and free maintenance periods that start
// on the handover date (or a chosen start date), plus what maintenance does and does not cover.
import { formatLongDate } from './fy.js';

export const HOSTING_PERIODS = [
  [0, 'No free hosting'],
  [12, '1 year'],
  [24, '2 years'],
  [36, '3 years'],
];

export const MAINTENANCE_PERIODS = [
  [0, 'No free maintenance'],
  [1, '1 month'],
  [3, '3 months'],
  [6, '6 months'],
  [12, '1 year'],
];

export const periodLabel = (months) =>
  !months ? '' : months % 12 === 0 ? `${months / 12} year${months > 12 ? 's' : ''}` : `${months} month${months > 1 ? 's' : ''}`;

export const DEFAULT_MAINTENANCE_INCLUDES = [
  'WordPress core, theme and plugin updates',
  'Security monitoring, malware and phishing clean-up',
  'Fixing errors or broken features on existing pages',
  'SSL certificate renewal and uptime checks',
  'Regular backups and restore if something breaks',
  'Small text or image swaps on existing pages',
];

export const DEFAULT_MAINTENANCE_EXCLUDES = [
  'New pages, sections or additional features',
  'Design changes or a redesign of existing pages',
  'Image generation, graphics, banners or social media creatives',
  'PDF, brochure, presentation or document creation',
  'Content writing, translation or data entry',
  'SEO, ads and digital marketing',
  'Paid plugins, third-party licences, domain and email renewals',
];

/** Last day of a period of `months` that starts on `start` (UTC dates). */
export function periodEnd(start, months) {
  if (!start || !months) return null;
  const d = new Date(start);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  // A shorter target month (31 Jan + 1 month) runs to its last day: 28 Feb.
  if (d.getUTCDate() > lastDay) return new Date(Date.UTC(y, m, lastDay));
  // Otherwise the same date `months` later, minus one day: 1 Nov 2026 + 1 year → 31 Oct 2027.
  return new Date(Date.UTC(y, m, d.getUTCDate()) - 86400000);
}

/** The day the free periods start: a chosen start date, else the handover date (null until known). */
export const periodStart = (h = {}) => h.startDate || h.handoverDate || null;

/** Validity dates and the sentence printed on the document. */
export function handoverSummary(h = {}) {
  const start = periodStart(h);
  const hostingEnd = periodEnd(start, h.hostingMonths);
  const maintenanceEnd = periodEnd(start, h.maintenanceMonths);
  const parts = [];
  if (h.hostingMonths) parts.push(`free hosting for ${periodLabel(h.hostingMonths)}`);
  if (h.maintenanceMonths) parts.push(`free maintenance for ${periodLabel(h.maintenanceMonths)}`);
  const what = parts.join(' and ');
  let sentence = '';
  if (what) {
    const handedOver = h.handoverDate ? `The website was handed over on ${formatLongDate(h.handoverDate)}. ` : '';
    sentence = h.startDate
      ? `${handedOver}This project includes ${what}, starting from ${formatLongDate(h.startDate)}.`
      : h.handoverDate
      ? `The website was handed over on ${formatLongDate(h.handoverDate)}. It includes ${what}, counted from that day.`
      : `This project includes ${what}. Both periods start on the day the website is handed over to you and run until the end date stated in the handover agreement.`;
  }
  return { start, hostingEnd, maintenanceEnd, sentence };
}
