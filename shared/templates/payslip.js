import { formatLongDate } from '../fy.js';
import { PAYMENT_MODE_LABELS } from '../constants.js';
import { amountInWords } from '../amountInWords.js';
import { renderDocument } from './layout.js';
import { amountTable, moneyLabel, companyLines, maskAccount } from './simpleTable.js';

/** Gross, deductions and net for a payout (minor units). */
export function computePayout({ earnings = [], deductions = [], bonus = 0 }) {
  const gross = earnings.reduce((s, e) => s + (e.amount || 0), 0);
  const totalDeductions = deductions.reduce((s, d) => s + (d.amount || 0), 0);
  return { gross, totalDeductions, bonus: bonus || 0, net: gross + (bonus || 0) - totalDeductions };
}

function paidToAccount(details) {
  if (!details) return '';
  if (details.method === 'upi') return details.upiId ? `UPI ${details.upiId}` : '';
  return [details.bankName, maskAccount(details.accountNumber) && `A/c ${maskAccount(details.accountNumber)}`].filter(Boolean).join(' · ');
}

/**
 * PAYSLIP (employees) or PAYMENT VOUCHER (freelancers).
 * `p`: { voucherNumber, date, periodLabel, project, earnings, deductions, bonus,
 *        mode, reference, notes, status, snapshot: { member, company } }
 */
export function renderPayslip(p, { settings, assets } = {}) {
  const company = p.snapshot?.company || settings?.company || {};
  const m = p.snapshot?.member || {};
  const isEmployee = m.type !== 'freelancer';
  const t = computePayout(p);
  const earnings = (p.earnings || []).filter((e) => e.label || e.amount);
  const deductions = (p.deductions || []).filter((d) => d.label || d.amount);

  const rows = [
    ...earnings.map((e) => ({ title: e.label, desc: e.note, amount: e.amount })),
    ...(t.bonus ? [{ title: 'Bonus', amount: t.bonus }] : []),
    ...deductions.map((d) => ({ title: `Less: ${d.label}`, desc: d.note, amount: d.amount, negative: true })),
  ];

  const totals = [
    { label: 'Gross Earnings', value: moneyLabel(t.gross), variant: 'panel' },
    ...(t.bonus ? [{ label: 'Bonus', value: moneyLabel(t.bonus) }] : []),
    ...(t.totalDeductions ? [{ label: 'Total Deductions', value: `− ${moneyLabel(t.totalDeductions)}` }] : []),
    { label: 'Net Paid', value: moneyLabel(t.net), variant: 'highlight' },
  ];

  return renderDocument(
    {
      title: isEmployee ? 'Payslip' : 'Payment Voucher',
      company,
      meta: [
        ['Voucher No:', p.voucherNumber || '—'],
        ['Date:', formatLongDate(p.date)],
        [p.project && !p.periodLabel ? 'Project:' : 'Period:', p.periodLabel || p.project],
        p.project && p.periodLabel ? ['Project:', p.project] : ['', ''],
      ],
      parties: [
        {
          label: 'Paid To',
          lines: [{ text: m.name || 'Team member', bold: true }, [m.role, m.type ? (isEmployee ? 'Employee' : 'Freelancer') : ''].filter(Boolean).join(' · '), m.email, m.phone],
        },
        { label: 'From', lines: companyLines(company) },
      ],
      tableHtml: amountTable(rows, 'INR', 'Add earnings'),
      totals,
      amountInWords: t.net > 0 ? amountInWords(t.net) : '',
      details: {
        title: 'Payment Details',
        rows: [[['Mode:', PAYMENT_MODE_LABELS[p.mode] || p.mode]], [['Reference No:', p.reference]], [['Paid to:', paidToAccount(m.payoutDetails)]]],
      },
      note: p.notes,
      thanks: isEmployee ? 'Thank you for your work this period.' : 'Thank you for your work!',
      footerText: settings?.invoiceDefaults?.footerText,
      stamp: p.status === 'void' ? 'void' : null,
    },
    assets,
  );
}
