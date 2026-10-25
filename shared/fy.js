// Financial year helpers. Default Indian FY runs April → March.
// Business dates are stored as UTC midnight of the chosen day, so every helper
// here reads UTC fields to stay correct regardless of server/browser timezone.
import { MONTHS } from './constants.js';

/** Calendar year in which the FY containing `date` starts. */
export function fyStartYear(date = new Date(), startMonth = 4) {
  const d = new Date(date);
  const month = d.getUTCMonth() + 1;
  return month >= startMonth ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

/** "2026-27" for a FY starting in 2026. Calendar-year FYs (startMonth 1) give "2026". */
export function fyLabel(date = new Date(), startMonth = 4) {
  const start = fyStartYear(date, startMonth);
  if (startMonth === 1) return String(start);
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** [from, to) date range of the FY that contains `date`. */
export function fyRange(date = new Date(), startMonth = 4) {
  const start = fyStartYear(date, startMonth);
  return {
    from: new Date(Date.UTC(start, startMonth - 1, 1)),
    to: new Date(Date.UTC(start + 1, startMonth - 1, 1)),
  };
}

/** Today as a "YYYY-MM-DD" string in the viewer's local timezone (for date inputs). */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Stored date → "YYYY-MM-DD" for date inputs. */
export function toDateInput(date) {
  if (!date) return '';
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** "29 September 2026" */
export function formatLongDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "29 Sep 2026" for tables. */
export function formatShortDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}
