import { fyRange, toDateInput } from '@webx/shared/fy.js';

const iso = (d) => toDateInput(d);
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));

/** Date range presets as { from, to } "YYYY-MM-DD" strings. */
export function presetRange(key, fyStartMonth = 4, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = utc(y, m, now.getDate());
  switch (key) {
    case 'this_month':
      return { from: iso(utc(y, m, 1)), to: iso(utc(y, m + 1, 0)) };
    case 'last_month':
      return { from: iso(utc(y, m - 1, 1)), to: iso(utc(y, m, 0)) };
    case 'this_quarter': {
      const fyStart = fyStartMonth - 1;
      const offset = (((m - fyStart) % 12) + 12) % 12;
      const qStart = m - (offset % 3);
      return { from: iso(utc(y, qStart, 1)), to: iso(utc(y, qStart + 3, 0)) };
    }
    case 'this_fy': {
      const r = fyRange(today, fyStartMonth);
      return { from: iso(r.from), to: iso(new Date(r.to.getTime() - 86400000)) };
    }
    case 'last_fy': {
      const r = fyRange(utc(y - 1, m, 1), fyStartMonth);
      return { from: iso(r.from), to: iso(new Date(r.to.getTime() - 86400000)) };
    }
    case 'all':
      return { from: '', to: '' };
    default:
      return null;
  }
}

export const PRESETS = [
  ['this_month', 'This month'],
  ['last_month', 'Last month'],
  ['this_quarter', 'This quarter'],
  ['this_fy', 'This FY'],
  ['last_fy', 'Last FY'],
  ['all', 'All time'],
  ['custom', 'Custom'],
];
