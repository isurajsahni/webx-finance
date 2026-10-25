import { formatAmount, currencySymbol } from '../money.js';
import { formatLongDate, formatShortDate } from '../fy.js';
import { amountInWords } from '../amountInWords.js';
import { esc, escLines } from './escape.js';
import { renderDocument } from './layout.js';
import { clientLines, fileSrc } from './partyLines.js';
import { upiLink, qrSvg } from '../upi.js';
import { handoverHtml } from './handoverSection.js';

const money = (minor, currency) => `${currencySymbol(currency).trim()} ${formatAmount(minor, currency)}`;
const pct = (n) => `${Number.isInteger(n) ? n : Number(n).toFixed(1)}%`;
const qtyFmt = (q) => (Number.isInteger(q) ? String(q) : Number(q).toFixed(2).replace(/0+$/, '').replace(/\.$/, ''));

function itemsTable(inv) {
  const items = inv.items || [];
  const showQty = items.some((i) => Number(i.qty) > 1 || (Number(i.qty) % 1 !== 0 && Number(i.qty) !== 1));
  const showSac = inv.gst?.enabled && items.some((i) => i.sac);
  const symbol = currencySymbol(inv.currency).trim();
  const cols = 2 + (showSac ? 1 : 0) + (showQty ? 2 : 0);

  const head = `<tr>
    <th>Description</th>
    ${showSac ? '<th class="col-sac">SAC/HSN</th>' : ''}
    ${showQty ? `<th class="col-qty num">Qty</th><th class="col-rate num">Rate (${esc(symbol)})</th>` : ''}
    <th class="col-amount num">Amount (${esc(symbol)})</th>
  </tr>`;

  const body = items.length
    ? items
        .map(
          (it) => `<tr>
      <td><div class="item-title">${esc(it.title) || '&nbsp;'}</div>${it.description ? `<div class="item-desc">${escLines(it.description)}</div>` : ''}</td>
      ${showSac ? `<td>${esc(it.sac)}</td>` : ''}
      ${showQty ? `<td class="num">${esc(qtyFmt(Number(it.qty)))}</td><td class="num">${esc(formatAmount(it.rate, inv.currency))}</td>` : ''}
      <td class="num">${esc(formatAmount(it.amount, inv.currency))}</td>
    </tr>`,
        )
        .join('')
    : `<tr class="empty-row"><td colspan="${cols}">Add a line item</td></tr>`;

  return `<table class="items${showQty || showSac ? ' wide' : ''}"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function totalsRows(inv) {
  const c = inv.currency;
  const rows = [];
  const hasAdjustments = inv.discountAmount > 0 || inv.gst?.enabled;
  const isAdvance = inv.split?.type === 'advance';

  if (hasAdjustments) {
    rows.push({ label: 'Subtotal', value: money(inv.subtotal, c) });
    if (inv.discountAmount > 0) {
      const label = inv.discount?.type === 'percent' ? `Discount (${pct(inv.discount.value)})` : 'Discount';
      rows.push({ label, value: `− ${money(inv.discountAmount, c)}` });
    }
    if (inv.gst?.enabled) {
      if (inv.gst.mode === 'inter') rows.push({ label: `IGST @ ${pct(inv.gst.rate)}`, value: money(inv.gst.igst, c) });
      else {
        rows.push({ label: `CGST @ ${pct(inv.gst.rate / 2)}`, value: money(inv.gst.cgst, c) });
        rows.push({ label: `SGST @ ${pct(inv.gst.rate / 2)}`, value: money(inv.gst.sgst, c) });
      }
    }
  }

  // Once money has come in, the invoice shows each payment and what is still due.
  const payments = (inv.payments || []).filter((p) => p.status !== 'void');
  const paidSoFar = payments.length > 0;

  if (isAdvance) {
    rows.push({ label: 'Project Total', value: money(inv.total, c), variant: 'panel' });
    const p = inv.split.advancePercent;
    const label = inv.docType === 'quote'
      ? `Advance on Acceptance${inv.split.advanceBy === 'amount' || p === null ? '' : ` (${pct(p)})`}`
      : inv.split.advanceBy === 'amount' || p === null ? 'Advance — Due Now' : `Advance — Due Now (${pct(p)})`;
    rows.push({ label: paidSoFar ? label.replace(' — Due Now', '') : label, value: money(inv.split.advanceAmount, c), variant: paidSoFar ? '' : 'highlight' });
    if (!paidSoFar) rows.push({ label: 'Balance — On Completion', value: money(inv.split.balanceAmount, c) });
  } else {
    rows.push({ label: inv.docType === 'quote' ? 'Total' : paidSoFar ? 'Invoice Total' : 'Total Due', value: money(inv.total, c), variant: paidSoFar ? 'panel' : 'highlight' });
  }

  if (paidSoFar) {
    for (const p of payments) {
      const what = { advance: 'Advance received', final: 'Final payment received' }[p.purpose] || 'Payment received';
      rows.push({ label: `${what} · ${formatShortDate(p.date)}`, sub: p.receiptNumber ? `Receipt ${p.receiptNumber}` : '', value: `− ${money(p.amount, c)}`, variant: 'muted' });
      if (p.tds > 0) rows.push({ label: 'TDS deducted by client', sub: p.receiptNumber ? `Receipt ${p.receiptNumber}` : '', value: `− ${money(p.tds, c)}`, variant: 'muted' });
    }
    const due = Math.max(0, inv.total - payments.reduce((s, p) => s + p.amount + (p.tds || 0), 0));
    rows.push({ label: due > 0 ? 'Balance Due' : 'Balance Due — Paid in full', value: money(due, c), variant: 'highlight' });
  }
  return rows;
}

function bankRows(bank, currency) {
  if (!bank) return [];
  const bankLine = [bank.bankName, bank.branch].filter(Boolean).join(' — ');
  return [
    [['Payable to:', bank.payableTo]],
    [['Bank:', bankLine]],
    [['A/c No:', bank.accountNumber], ['IFSC:', bank.ifsc]],
    [['UPI ID:', bank.upiId]],
    currency !== 'INR' ? [['SWIFT:', bank.swift]] : [],
  ];
}

/** What the client should pay now: the advance until something is paid, then the balance. */
export function amountDueNow(inv) {
  const paid = (inv.payments || []).filter((p) => p.status !== 'void').reduce((s, p) => s + p.amount + (p.tds || 0), 0);
  if (inv.split?.type === 'advance' && paid === 0) return inv.split.advanceAmount;
  return Math.max(0, (inv.total || 0) - paid);
}

function upiAside(inv, bank, company) {
  if (inv.docType === 'quote' || !bank?.upiId || (inv.currency && inv.currency !== 'INR') || ['paid', 'cancelled'].includes(inv.status)) return '';
  const due = amountDueNow(inv);
  if (!(due > 0)) return '';
  const link = upiLink({ upiId: bank.upiId, payee: bank.payableTo || company.name, amountMinor: due, note: inv.number ? `Invoice ${inv.number}` : 'Invoice payment' });
  return `<div class="upi">${qrSvg(link)}<div class="cap">Scan to pay with any UPI app<br><b>${esc(money(due, 'INR'))}</b></div></div>`;
}

/**
 * Render an invoice. `inv` is a saved invoice or the live form state, with
 * computed totals (see computeInvoice) and snapshots of client/company/bank.
 */
export function renderInvoice(inv, { settings, assets } = {}) {
  const company = inv.snapshot?.company || settings?.company || {};
  const client = inv.snapshot?.client || {};
  const bank = inv.snapshot?.bank;
  const defaults = settings?.invoiceDefaults || {};
  const due = inv.dueDate ? formatLongDate(inv.dueDate) : inv.dueText;

  const fromLines = [
    { text: company.name, bold: true },
    company.address,
    (company.phones || []).join(' · '),
    [company.email, company.website].filter(Boolean).join(' · '),
    company.gstin ? `GSTIN: ${company.gstin}` : '',
  ];
  const toLines = clientLines(client, { withPlaceOfSupply: !!inv.gst?.enabled });

  const isQuote = inv.docType === 'quote';
  const stamp = inv.status === 'cancelled' ? 'cancelled' : inv.status === 'paid' ? 'paid' : inv.status === 'draft' ? 'draft' : isQuote && ['accepted', 'declined'].includes(inv.status) ? inv.status : null;

  return renderDocument(
    {
      title: isQuote ? 'Quotation' : 'Invoice',
      company,
      meta: [
        [isQuote ? 'Quote No:' : 'Invoice No:', inv.number || 'Draft'],
        ['Date:', formatLongDate(inv.issueDate)],
        isQuote ? ['Valid until:', formatLongDate(inv.validUntil)] : ['Due:', due],
        !isQuote && inv.quoteNumber ? ['Quote ref:', inv.quoteNumber] : ['', ''],
        inv.parentNumber ? ['Against:', `Invoice ${inv.parentNumber}`] : ['', ''],
        inv.currency && inv.currency !== 'INR' ? ['Currency:', inv.currency] : ['', ''],
      ],
      parties: [
        { label: isQuote ? 'Prepared For' : 'Billed To', lines: toLines, logoSrc: fileSrc(assets, client.logo) },
        { label: 'From', lines: fromLines },
      ],
      tableHtml: itemsTable(inv),
      totals: totalsRows(inv),
      amountInWords: inv.total > 0 ? `${amountInWords(inv.total, inv.currency)} (${isQuote ? 'quoted total' : 'invoice total'})` : '',
      details: { title: 'Payment Details', rows: bankRows(bank, inv.currency), asideHtml: upiAside(inv, bank, company) },
      sectionsHtml: handoverHtml(inv.handover),
      note: inv.note,
      terms: inv.terms ?? defaults.terms,
      signature: defaults.showSignature === false ? null : { company: company.name, src: assets?.signatureSrc || '' },
      thanks: isQuote ? 'We look forward to working with you!' : defaults.thankYouText ?? 'Thank you for your business!',
      footerText: defaults.footerText,
      stamp,
    },
    assets,
  );
}
