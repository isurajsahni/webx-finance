import { formatLongDate } from '../fy.js';
import { handoverSummary, periodLabel } from '../handover.js';
import { esc } from './escape.js';

/** "Website Handover, Hosting & Maintenance" block for invoices and quotes. */
export function handoverHtml(h) {
  if (!h?.enabled || !(h.hostingMonths || h.maintenanceMonths || h.includes?.length || h.excludes?.length)) return '';
  const { hostingEnd, maintenanceEnd, sentence } = handoverSummary(h);
  const pending = 'from handover date';
  const cards = [
    ['Handover date', h.handoverDate ? formatLongDate(h.handoverDate) : 'On delivery of the website'],
    h.startDate ? ['Free period starts', formatLongDate(h.startDate)] : null,
    h.hostingMonths ? ['Free hosting', `${periodLabel(h.hostingMonths)}${hostingEnd ? ` · until ${formatLongDate(hostingEnd)}` : ` ${pending}`}`] : null,
    h.maintenanceMonths ? ['Free maintenance', `${periodLabel(h.maintenanceMonths)}${maintenanceEnd ? ` · until ${formatLongDate(maintenanceEnd)}` : ` ${pending}`}`] : null,
  ].filter(Boolean);
  const list = (items) => `<ul>${(items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
  return `<div class="handover">
    <div class="section-title">Website Handover, Hosting &amp; Maintenance</div>
    <div class="ho-cards">${cards.map(([k, v]) => `<div class="ho-card"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
    ${sentence ? `<p class="ho-note">${esc(sentence)}</p>` : ''}
    <div class="ho-lists">
      ${h.includes?.length ? `<div class="inc"><b>Included in ${h.maintenanceMonths ? 'free ' : ''}maintenance</b>${list(h.includes)}</div>` : ''}
      ${h.excludes?.length ? `<div class="exc"><b>Not included (quoted and billed separately)</b>${list(h.excludes)}</div>` : ''}
    </div>
  </div>`;
}
