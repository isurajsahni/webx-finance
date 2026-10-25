import { formatLongDate } from '../fy.js';
import { PAYMENT_MODE_LABELS } from '../constants.js';
import { amountInWords } from '../amountInWords.js';
import { renderDocument } from './layout.js';
import { amountTable, moneyLabel, companyLines, maskAccount } from './simpleTable.js';

function fromAccount(bank) {
  if (!bank) return '';
  if (bank.kind === 'cash') return bank.label || 'Cash';
  return [bank.bankName || bank.label, maskAccount(bank.accountNumber) && `A/c ${maskAccount(bank.accountNumber)}`].filter(Boolean).join(' · ');
}

/**
 * EXPENSE VOUCHER or REIMBURSEMENT VOUCHER.
 * `e`: { voucherNumber, date, categoryName, vendor, description, lines, amount,
 *        mode, reference, project, isReimbursement, reimbursement, status,
 *        snapshot: { company, paidFrom, clientName } }
 */
export function renderExpenseVoucher(e, { settings, assets } = {}) {
  const company = e.snapshot?.company || settings?.company || {};
  const reimb = e.isReimbursement ? e.reimbursement || {} : null;
  const lines = (e.lines || []).filter((l) => l.description || l.amount);
  const total = lines.reduce((s, l) => s + (l.amount || 0), 0);
  const payee = reimb ? reimb.payeeName : e.vendor;
  const mode = reimb ? reimb.mode : e.mode;
  const reference = reimb ? reimb.reference : e.reference;
  const paidFrom = reimb ? e.snapshot?.reimbursedFrom : e.snapshot?.paidFrom;

  return renderDocument(
    {
      title: reimb ? 'Reimbursement Voucher' : 'Expense Voucher',
      company,
      meta: [
        ['Voucher No:', e.voucherNumber || '—'],
        ['Date:', formatLongDate(reimb?.reimbursedAt || e.date)],
        ['Category:', e.categoryName],
        reimb ? ['Expense date:', formatLongDate(e.date)] : ['', ''],
      ],
      parties: [
        {
          label: 'Paid To',
          lines: [{ text: payee || (reimb ? 'Payee' : 'Vendor'), bold: true }, reimb && e.vendor ? `Spent at: ${e.vendor}` : '', reimb?.payeeRole],
        },
        { label: 'From', lines: companyLines(company) },
      ],
      tableHtml: amountTable(lines.map((l) => ({ title: l.description, amount: l.amount })), 'INR', 'Add an expense line'),
      totals: [{ label: 'Total Paid', value: moneyLabel(total), variant: 'highlight' }],
      amountInWords: total > 0 ? amountInWords(total) : '',
      details: {
        title: 'Payment Details',
        rows: [
          [['Mode:', PAYMENT_MODE_LABELS[mode] || mode]],
          [['Reference No:', reference]],
          [['Paid from:', fromAccount(paidFrom)]],
          [['Client / project:', [e.snapshot?.clientName, e.project].filter(Boolean).join(' · ')]],
        ],
      },
      note: e.description,
      footerText: settings?.invoiceDefaults?.footerText,
      stamp: e.status === 'void' ? 'void' : null,
    },
    assets,
  );
}
