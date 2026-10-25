// Generic branded document. Invoice, receipt, payslip and voucher all render
// through renderDocument() so they share one design.
import { esc, escLines } from './escape.js';
import { documentCss } from './styles.js';

/** "The Web{X} Studio · thewebxstudio.com · +91 …": first part bold, spaced dots. */
export function footerHtml(text) {
  const parts = String(text || '').split(/\s*·\s*/).filter(Boolean);
  return parts.map((p, i) => (i === 0 ? `<b>${esc(p)}</b>` : esc(p))).join('&nbsp;&nbsp;·&nbsp;&nbsp;');
}

/** Footer for Puppeteer's footerTemplate (rendered in an isolated context: inline styles only). */
export function pdfFooterTemplate(text, fontCss = '') {
  return `${fontCss ? `<style>${fontCss}</style>` : ''}<div style="width:100%;padding:0 22mm;font-family:Lato,'Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;">
    <div style="border-top:1px solid #D9D6E8;padding-top:4pt;text-align:center;font-size:7.5pt;color:#6B7280;">${footerHtml(text).replace(/<b>/g, '<b style="color:#1F2937">')}</div>
  </div>`;
}

function partyHtml(p) {
  if (!p) return '<div></div>';
  const lines = (p.lines || []).filter((l) => l && (l.text ?? l) !== '');
  return `<div class="party">
    <div class="label">${esc(p.label)}</div>
    ${p.logoSrc ? `<img class="party-logo" src="${esc(p.logoSrc)}" alt="">` : ''}
    ${lines.map((l) => (typeof l === 'string' ? `<div class="line">${escLines(l)}</div>` : `<div class="${l.bold ? 'name' : `line${l.small ? ' small' : ''}`}">${escLines(l.text)}</div>`)).join('')}
  </div>`;
}

function totalsHtml(rows, words) {
  if (!rows?.length) return '';
  const left = words ? `<div class="words"><b>Amount in words</b><br>${esc(words)}</div>` : '';
  return `<div class="totals-wrap${left ? ' has-left' : ''}">${left}<table class="totals"><tbody>
    ${rows.map((r) => `<tr class="${r.variant || ''}"><td>${esc(r.label)}${r.sub ? `<div class="sub">${esc(r.sub)}</div>` : ''}</td><td class="val">${esc(r.value)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

/** rows: array of lines; each line is an array of [label, value] pairs. */
function kvHtml(title, rows, asideHtml = '') {
  const lines = (rows || []).map((pairs) => pairs.filter(([, v]) => v)).filter((pairs) => pairs.length);
  if (!lines.length && !asideHtml) return '';
  const kv = `<div>
    <div class="section-title">${esc(title)}</div>
    ${lines.map((pairs) => `<div class="row">${pairs.map(([k, v]) => `<span class="k">${esc(k)}</span><span>${esc(v)}</span>`).join('')}</div>`).join('')}
  </div>`;
  return `<div class="kv${asideHtml ? ' with-aside' : ''}">${kv}${asideHtml}</div>`;
}

/**
 * @param {object} d
 * @param {string} d.title                 "INVOICE"
 * @param {object} d.company               { name, tagline }
 * @param {[string,string][]} d.meta        right-aligned label/value pairs
 * @param {object[]} d.parties             [{ label, lines: [{text, bold}] }] (two columns)
 * @param {string} d.tableHtml             pre-rendered, already escaped
 * @param {object[]} d.totals              [{ label, value, variant: 'panel'|'highlight'|'muted' }]
 * @param {object} d.details               { title, rows } for the key/value section
 * @param {string} d.note
 * @param {string} d.amountInWords
 * @param {string} d.thanks
 * @param {string} d.footerText
 * @param {string} d.stamp                 'draft' | 'paid' | 'cancelled'
 * @param {object} assets                  { fontCss, logoSrc }
 */
export function renderDocument(d, assets = {}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(d.title)}</title>
<style>${assets.fontCss || ''}${documentCss}</style></head>
<body><div class="sheet">
  ${d.stamp ? `<div class="stamp ${esc(d.stamp)}">${esc(d.stamp)}</div>` : ''}
  <header class="head">
    <div class="brand">
      ${assets.logoSrc ? `<img class="logo" src="${esc(assets.logoSrc)}" alt="">` : ''}
      <div><div class="brand-name">${esc(d.company?.name)}</div><div class="tagline">${esc(d.company?.tagline)}</div></div>
    </div>
    <div class="doc-title${String(d.title).length > 10 ? ' long' : ''}">${esc(d.title)}</div>
  </header>
  <div class="rule"></div>
  <dl class="meta">${(d.meta || []).filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
  <section class="parties">${(d.parties || []).map(partyHtml).join('')}</section>
  ${d.tableHtml || ''}
  ${totalsHtml(d.totals, d.amountInWords)}
  ${d.amountInWords && !d.totals?.length ? `<div class="words"><b>Amount in words:</b> ${esc(d.amountInWords)}</div>` : ''}
  ${d.details ? kvHtml(d.details.title, d.details.rows, d.details.asideHtml) : ''}
  ${d.note ? `<div class="note"><b>Note:</b>&nbsp; ${escLines(d.note)}</div>` : ''}
  ${d.sectionsHtml || ''}
  ${d.terms || d.signature ? `<div class="closing">
    <div class="terms">${d.thanks ? `<p class="thanks-inline">${esc(d.thanks)}</p>` : ''}${d.terms ? `<div class="section-title">Terms &amp; Conditions</div><ol>${String(d.terms).split(/\r?\n/).filter((l) => l.trim()).map((l) => `<li>${esc(l.replace(/^\s*(\d+[.)]|[-•*])\s*/, ''))}</li>`).join('')}</ol>` : ''}</div>
    ${d.signature ? `<div class="sign">
      <div class="for">For ${esc(d.signature.company)}</div>
      ${d.signature.src ? `<img src="${esc(d.signature.src)}" alt="">` : '<div class="blank"></div>'}
      <div class="who">Authorised Signatory</div>
    </div>` : ''}
  </div>` : ''}
  ${d.thanks && !(d.terms || d.signature) ? `<p class="thanks">${esc(d.thanks)}</p>` : ''}
  <footer class="doc-footer">${footerHtml(d.footerText)}</footer>
</div></body></html>`;
}
