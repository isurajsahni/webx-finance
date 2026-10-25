import { formatAmount, currencySymbol } from '../money.js';
import { formatLongDate } from '../fy.js';
import { PAYMENT_MODE_LABELS } from '../constants.js';
import { amountInWords } from '../amountInWords.js';
import { esc } from './escape.js';
import { renderDocument } from './layout.js';
import { clientLines, fileSrc } from './partyLines.js';

const PURPOSE = { advance: 'Advance payment', part: 'Part payment', final: 'Final payment' };

const money = (minor, currency) => `${currencySymbol(currency).trim()} ${formatAmount(minor, currency)}`;

/** "HDFC Current — HDFC Bank · A/c ••••5678" */
export function accountLine(bank) {
  if (!bank) return '';
  if (bank.kind === 'cash') return bank.label || 'Cash';
  const acct = bank.accountNumber ? `A/c ••••${String(bank.accountNumber).slice(-4)}` : '';
  return [bank.bankName || bank.label, acct].filter(Boolean).join(' · ');
}

/**
 * Receipt for one payment. `p` is a saved payment (or form state) with
 * snapshot { client, company, bank, invoice: { number, total, title } },
 * previouslyReceived and balanceAfter.
 */
export function renderReceipt(p, { settings, assets } = {}) {
  const c = p.currency || 'INR';
  const company = p.snapshot?.company || settings?.company || {};
  const client = p.snapshot?.client || {};
  const inv = p.snapshot?.invoice || {};
  const defaults = settings?.invoiceDefaults || {};
  const symbol = currencySymbol(c).trim();

  const rows = [
    { title: `${PURPOSE[p.purpose] || 'Payment'} against Invoice No ${inv.number || '—'}`, desc: [inv.title, p.purpose === 'final' ? 'Invoice settled in full' : ''].filter(Boolean).join(' · '), amount: p.amount },
    ...(p.tds > 0 ? [{ title: 'TDS deducted by client', desc: 'Credited against the invoice; certificate (Form 16A) to follow.', amount: p.tds }] : []),
  ];
  const tableHtml = `<table class="items"><thead><tr><th>Description</th><th class="col-amount num">Amount (${esc(symbol)})</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td><div class="item-title">${esc(r.title)}</div>${r.desc ? `<div class="item-desc">${esc(r.desc)}</div>` : ''}</td><td class="num">${esc(formatAmount(r.amount, c))}</td></tr>`).join('')}
  </tbody></table>`;

  const totals = [
    { label: 'Invoice Total', value: money(inv.total || 0, c), variant: 'panel' },
    ...(p.previouslyReceived > 0 ? [{ label: 'Previously Received', value: money(p.previouslyReceived, c) }] : []),
    { label: 'Amount Received', value: money(p.amount || 0, c), variant: 'highlight' },
    ...(p.tds > 0 ? [{ label: 'TDS Deducted', value: money(p.tds, c) }] : []),
    { label: 'Balance Remaining', value: money(Math.max(0, p.balanceAfter ?? 0), c) },
  ];

  return renderDocument(
    {
      title: 'Receipt',
      company,
      meta: [
        ['Receipt No:', p.receiptNumber || '—'],
        ['Date:', formatLongDate(p.date)],
        ['Against Invoice No:', inv.number],
      ],
      parties: [
        { label: 'Received From', lines: clientLines(client), logoSrc: fileSrc(assets, client.logo) },
        {
          label: 'From',
          lines: [{ text: company.name, bold: true }, company.address, (company.phones || []).join(' · '), [company.email, company.website].filter(Boolean).join(' · ')],
        },
      ],
      tableHtml,
      totals,
      amountInWords: p.amount > 0 ? amountInWords(p.amount, c) : '',
      details: {
        title: 'Payment Details',
        rows: [
          [['Mode:', PAYMENT_MODE_LABELS[p.mode] || p.mode]],
          [['Reference No:', p.reference]],
          [['Received into:', accountLine(p.snapshot?.bank)]],
          c !== 'INR' && p.exchangeRate ? [['Exchange rate:', `1 ${c} = ₹${p.exchangeRate}`]] : [],
        ],
      },
      note: p.notes,
      thanks: 'Thank you for your payment!',
      footerText: defaults.footerText,
      stamp: p.status === 'void' ? 'void' : null,
    },
    assets,
  );
}
