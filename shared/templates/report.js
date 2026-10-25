import { esc } from './escape.js';
import { documentCss, COLORS } from './styles.js';
import { footerHtml } from './layout.js';

const reportCss = `
.report-sub { color: ${COLORS.muted}; font-size: 9.5pt; margin: 0 0 14pt; text-align: right; }
.rtable { margin: 0 0 18pt; break-inside: auto; }
.rtable caption { text-align: left; font-weight: 700; color: ${COLORS.accent}; font-size: 10pt; letter-spacing: 0.04em; padding: 0 0 5pt; }
.rtable thead { display: table-header-group; }
.rtable th { background: ${COLORS.black}; color: #fff; font-size: 8.5pt; font-weight: 700; padding: 5pt 7pt; text-align: left; }
.rtable td { border: 1px solid ${COLORS.border}; padding: 4pt 7pt; font-size: 8.5pt; }
.rtable .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.rtable tr { break-inside: avoid; }
.rtable tr.total td { background: ${COLORS.lavender}; font-weight: 700; color: ${COLORS.black}; border-color: ${COLORS.accent}; }
.rtable .empty { color: ${COLORS.muted}; font-style: italic; text-align: center; }
`;

/**
 * Branded tabular report.
 * tables: [{ title, columns: [{ label, align }], rows: [[string]], total: [string] }]
 * All cell values are pre-formatted strings.
 */
export function renderReport({ title, subtitle, company = {}, footerText, tables = [] }, assets = {}) {
  const tableHtml = tables
    .map(
      (t) => `<table class="rtable">
        ${t.title ? `<caption>${esc(t.title)}</caption>` : ''}
        <thead><tr>${t.columns.map((c) => `<th class="${c.align === 'right' ? 'num' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${t.rows.length ? t.rows.map((r) => `<tr>${r.map((v, i) => `<td class="${t.columns[i].align === 'right' ? 'num' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('') : `<tr><td class="empty" colspan="${t.columns.length}">No data for this period</td></tr>`}
          ${t.total ? `<tr class="total">${t.total.map((v, i) => `<td class="${t.columns[i].align === 'right' ? 'num' : ''}">${esc(v)}</td>`).join('')}</tr>` : ''}
        </tbody>
      </table>`,
    )
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${assets.fontCss || ''}${documentCss}${reportCss}</style></head>
<body><div class="sheet">
  <header class="head">
    <div class="brand">
      ${assets.logoSrc ? `<img class="logo" src="${esc(assets.logoSrc)}" alt="">` : ''}
      <div><div class="brand-name">${esc(company.name)}</div><div class="tagline">${esc(company.tagline)}</div></div>
    </div>
    <div class="doc-title${title.length > 10 ? ' long' : ''}">${esc(title)}</div>
  </header>
  <div class="rule"></div>
  ${subtitle ? `<p class="report-sub">${esc(subtitle)}</p>` : ''}
  ${tableHtml}
  <footer class="doc-footer">${footerHtml(footerText)}</footer>
</div></body></html>`;
}
