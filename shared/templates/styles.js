// Brand document styles. A4 portrait, ~22mm side margins, Lato.
// Screen rules make the preview look like a printed sheet; print rules are
// what Puppeteer uses (page margins come from @page, footer from Puppeteer).
export const COLORS = {
  accent: '#A855F7',
  black: '#0A0A0A',
  body: '#1F2937',
  muted: '#6B7280',
  panel: '#F3F2F9',
  lavender: '#EDE7FE',
  border: '#D9D6E8',
};

export const PAGE_MARGIN = { top: '18mm', right: '22mm', bottom: '20mm', left: '22mm' };

export const documentCss = `
@page { size: A4; margin: ${PAGE_MARGIN.top} ${PAGE_MARGIN.right} ${PAGE_MARGIN.bottom} ${PAGE_MARGIN.left}; }
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Lato', 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
  font-size: 10pt; line-height: 1.45; color: ${COLORS.body};
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  font-variant-numeric: lining-nums;
}
.sheet { background: #fff; }
@media screen {
  body { background: #fff; }
  .sheet { width: 210mm; min-height: 297mm; padding: ${PAGE_MARGIN.top} ${PAGE_MARGIN.right} 26mm ${PAGE_MARGIN.left}; position: relative; }
  .doc-footer { position: absolute; left: ${PAGE_MARGIN.left}; right: ${PAGE_MARGIN.right}; bottom: 8mm; }
}
@media print { .doc-footer { display: none; } }

.head { display: flex; align-items: center; justify-content: space-between; gap: 16pt; }
.brand { display: flex; align-items: center; gap: 13pt; flex: none; }
.logo { width: 41pt; height: 41pt; border-radius: 9pt; object-fit: contain; flex: none; }
.brand-name { white-space: nowrap; font-size: 13pt; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: ${COLORS.black}; line-height: 1.15; }
.tagline { font-size: 7pt; color: ${COLORS.muted}; margin-top: 2pt; white-space: nowrap; }
.doc-title { font-size: 23pt; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: ${COLORS.accent}; line-height: 1.05; text-align: right; }
.doc-title.long { font-size: 17pt; }
.rule { height: 2px; background: ${COLORS.accent}; margin: 12pt 0 8pt; }

.meta { display: grid; grid-template-columns: auto auto; justify-content: end; column-gap: 5pt; row-gap: 2pt; margin: 0 8pt 0 0; font-size: 9.5pt; }
.meta dt { font-weight: 700; color: ${COLORS.muted}; text-align: right; }
.meta dd { margin: 0; color: ${COLORS.body}; }

.parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20pt; margin: 16pt 5pt 14pt; }
.label { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${COLORS.accent}; margin-bottom: 4pt; }
.party .name { font-weight: 700; font-size: 10.5pt; color: ${COLORS.black}; }
.party .line { font-size: 9.5pt; }
.party .line.small { font-size: 8.5pt; color: ${COLORS.muted}; }
.party-logo { display: block; max-height: 26pt; max-width: 110pt; object-fit: contain; margin: 1pt 0 4pt; }

table { border-collapse: collapse; width: 100%; }
.items { margin-top: 2pt; }
.items thead { display: table-header-group; }
.items th { background: ${COLORS.black}; color: #fff; font-weight: 700; font-size: 9.5pt; text-align: left; padding: 7pt 10pt; }
.items th.num, .items td.num { text-align: right; }
.items td { border: 1px solid ${COLORS.border}; padding: 6pt 10pt; vertical-align: middle; font-size: 9.5pt; }
.items tr { break-inside: avoid; page-break-inside: avoid; }
.items .col-amount { width: 25%; }
.items.wide .col-amount { width: 17%; }
.items .col-qty { width: 7%; }
.items .col-rate { width: 14%; }
.items .col-sac { width: 11%; }
.item-title { font-weight: 700; color: ${COLORS.black}; font-size: 10pt; }
.item-desc { color: ${COLORS.muted}; font-size: 8.5pt; margin-top: 1pt; }
.empty-row td { color: ${COLORS.muted}; font-style: italic; text-align: center; }

.totals-wrap { display: flex; justify-content: flex-end; margin-top: 12pt; break-inside: avoid; page-break-inside: avoid; }
.totals { width: 56%; }
.totals td { border: 1px solid ${COLORS.border}; padding: 5pt 10pt; font-size: 9.5pt; }
.totals .sub { font-size: 7.5pt; color: ${COLORS.muted}; font-weight: 400; }
.totals td.val { text-align: right; width: 41%; white-space: nowrap; }
.totals tr.panel td { background: ${COLORS.panel}; font-weight: 700; font-size: 10pt; color: ${COLORS.black}; }
.totals tr.highlight td { background: ${COLORS.lavender}; border-color: ${COLORS.accent}; font-weight: 700; font-size: 10pt; color: ${COLORS.black}; }
.totals tr.highlight td.val { color: ${COLORS.accent}; font-size: 11pt; }
.totals tr.muted td { color: ${COLORS.muted}; }

.section-title { font-size: 9.5pt; font-weight: 700; letter-spacing: 0.06em; color: ${COLORS.accent}; margin: 14pt 0 2pt; }
.kv { font-size: 9.5pt; line-height: 1.5; break-inside: avoid; page-break-inside: avoid; }
.kv .row span + span.k { margin-left: 22pt; }
.kv .k { font-weight: 700; color: ${COLORS.muted}; margin-right: 4pt; }
.kv.with-aside { display: flex; justify-content: space-between; align-items: flex-end; gap: 16pt; margin-top: 8pt; }
.upi { text-align: center; flex: none; border: 1px solid ${COLORS.border}; border-radius: 6pt; padding: 5pt 7pt 4pt; }
.upi svg { display: block; width: 62pt; height: 62pt; margin: 0 auto; }
.upi .cap { font-size: 7pt; color: ${COLORS.muted}; margin-top: 2pt; line-height: 1.3; }
.upi .cap b { color: ${COLORS.black}; font-size: 8pt; }

.note { margin-top: 10pt; background: ${COLORS.panel}; border-left: 4px solid ${COLORS.accent}; padding: 5pt 9pt; font-size: 9.5pt; break-inside: avoid; page-break-inside: avoid; }
.note b { color: ${COLORS.black}; }
.words { margin-top: 7pt; font-size: 9pt; }
.totals-wrap.has-left { justify-content: space-between; align-items: flex-end; gap: 18pt; }
.totals-wrap.has-left .words { margin: 0; max-width: 40%; font-size: 8.5pt; line-height: 1.4; }
.words b { color: ${COLORS.muted}; }
.closing { display: flex; justify-content: space-between; align-items: flex-end; gap: 24pt; margin-top: 2pt; break-inside: avoid; page-break-inside: avoid; }
.terms { flex: 1; font-size: 8pt; color: ${COLORS.muted}; }
.thanks-inline { margin: 12pt 0 0; font-weight: 700; font-size: 10pt; color: ${COLORS.black}; }
.terms ol { margin: 2pt 0 0; padding-left: 12pt; }
.terms li { margin: 1pt 0; }
.sign { flex: none; width: 150pt; text-align: center; font-size: 8.5pt; }
.sign .for { font-weight: 700; color: ${COLORS.black}; margin-bottom: 3pt; }
.sign img { display: block; max-height: 42pt; max-width: 140pt; margin: 0 auto; object-fit: contain; }
.sign .blank { height: 34pt; }
.sign .who { border-top: 1px solid ${COLORS.border}; padding-top: 3pt; margin-top: 2pt; color: ${COLORS.muted}; }
.handover { margin-top: 10pt; break-inside: avoid; page-break-inside: avoid; }
.ho-cards { display: flex; gap: 6pt; margin-top: 3pt; }
.ho-card { flex: 1; background: ${COLORS.panel}; border-radius: 4pt; padding: 4pt 7pt; }
.ho-card .k { font-size: 7pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${COLORS.muted}; }
.ho-card .v { font-size: 9pt; font-weight: 700; color: ${COLORS.black}; }
.ho-note { font-size: 8.5pt; margin: 5pt 0 3pt; }
.ho-lists { display: grid; grid-template-columns: 1fr 1fr; gap: 14pt; font-size: 8pt; }
.ho-lists b { display: block; font-size: 8.5pt; margin-bottom: 1pt; }
.ho-lists .inc b { color: #047857; }
.ho-lists .exc b { color: #B45309; }
.ho-lists ul { margin: 0; padding-left: 11pt; color: ${COLORS.body}; }
.ho-lists li { margin: 0.5pt 0; }
.thanks { text-align: center; font-weight: 700; color: ${COLORS.black}; margin-top: 14pt; font-size: 10.5pt; }

.doc-footer { border-top: 1px solid ${COLORS.border}; padding-top: 4pt; text-align: center; font-size: 7.5pt; color: ${COLORS.muted}; }
.doc-footer b { color: ${COLORS.body}; }
.stamp { position: absolute; top: 60mm; right: 26mm; transform: rotate(-12deg); border: 3px solid currentColor; border-radius: 6pt; padding: 3pt 10pt; font-weight: 900; font-size: 20pt; letter-spacing: 0.1em; opacity: 0.22; text-transform: uppercase; }
.stamp.cancelled, .stamp.void { color: #DC2626; }
.stamp.paid { color: #059669; }
.stamp.draft { color: ${COLORS.muted}; }
.stamp.accepted { color: #059669; }
.stamp.declined { color: #DC2626; }
@media print { .stamp { position: fixed; top: 40mm; right: 4mm; } }
`;
