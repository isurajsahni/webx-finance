// Render sample invoices to PDF without a database (template check).
//   node scripts/render-sample.js <outDir>
import fs from 'node:fs/promises';
import path from 'node:path';
import { computeInvoice, splitNote } from '@webx/shared/invoiceMath.js';
import { renderInvoice, renderReceipt, renderPayslip, renderExpenseVoucher } from '@webx/shared/templates/index.js';
import { renderPdf, closePdfBrowser } from '../src/services/pdf.js';

process.env.JWT_SECRET ||= 'x'.repeat(32);
const { documentAssets, footerFontCss } = await import('../src/services/documentAssets.js');
const footerFont = await footerFontCss();

const outDir = process.argv[2] || '.';
const settings = {
  company: {
    name: 'The Web{X} Studio',
    tagline: 'Web Design · Development · Graphic & UI/UX Design',
    address: 'Model Town, Ludhiana, Punjab, India',
    phones: ['+91 79733 86875', '+91 97806 51142'],
    email: 'hello@thewebxstudio.com',
    website: 'thewebxstudio.com',
  },
  invoiceDefaults: { thankYouText: 'Thank you for your business!', footerText: 'The Web{X} Studio · thewebxstudio.com · +91 97806 51142' },
};
const bank = { payableTo: 'Account Holder (The Web{X} Studio)', bankName: 'Sample Bank', branch: 'Ludhiana, Model Town', accountNumber: '000000000000', ifsc: 'ABCD0000000', upiId: 'sample@upi' };
const assets = await documentAssets(settings);

function build(input, extra) {
  const c = computeInvoice(input);
  return { ...input, ...c, ...extra, note: extra.note ?? splitNote({ split: c.split, total: c.total, currency: input.currency }) };
}

const samples = {
  'sample-advance': build(
    {
      currency: 'INR',
      items: [{ title: 'Website Design & Development', description: 'Complete custom website for GS Associates — design, build & launch.', qty: 1, rate: 1500000 }],
      split: { type: 'advance', advanceBy: 'percent', advanceValue: 30 },
    },
    { number: '2026-27/0903', issueDate: '2026-09-29', dueText: 'On receipt (advance)', snapshot: { company: settings.company, bank, client: { name: 'GS Associates', secondaryName: 'Gurpreet Singh & Associates' } } },
  ),
  'sample-gst-long': build(
    {
      currency: 'INR',
      items: Array.from({ length: 24 }, (_, i) => ({ title: `Deliverable ${i + 1}`, description: 'Design, development and QA for this part of the project.', sac: '998314', qty: (i % 3) + 1, rate: 250000 + i * 1000 })),
      discount: { type: 'percent', value: 10 },
      gst: { enabled: true, rate: 18, mode: 'intra' },
      split: { type: 'full' },
    },
    { number: '2026-27/0904', issueDate: '2026-10-10', dueDate: '2026-10-25', snapshot: { company: { ...settings.company, gstin: '03ABCDE1234F1Z5' }, bank, client: { name: 'Acme Pvt Ltd', address: 'Sector 17, Chandigarh', gstin: '04AAACA1234A1Z2' } } },
  ),
};

const receipt = {
  receiptNumber: 'RCPT-2026-27/0001', date: '2026-10-09', amount: 630000, tds: 70000, currency: 'INR', mode: 'bank_transfer', reference: 'NEFT987654',
  previouslyReceived: 450000, balanceAfter: 400000,
  snapshot: { company: settings.company, client: { name: 'GS Associates', secondaryName: 'Gurpreet Singh & Associates' }, bank: { kind: 'bank', bankName: 'Sample Bank', accountNumber: '000000005678' }, invoice: { number: '2026-27/0903', total: 1500000, title: 'Website Design & Development' } },
};

const payslip = {
  voucherNumber: 'PAY-2026-27/0001', date: '2026-10-01', periodLabel: 'September 2026', mode: 'bank_transfer', reference: 'NEFT123',
  earnings: [{ label: 'Monthly salary', amount: 3000000 }, { label: 'Project allowance', note: 'GS Associates website', amount: 250000 }], bonus: 500000, deductions: [{ label: 'TDS', amount: 300000 }],
  snapshot: { company: settings.company, member: { name: 'Riya Sharma', role: 'UI Designer', type: 'employee', email: 'riya@example.com', payoutDetails: { method: 'bank', bankName: 'HDFC', accountNumber: '123456789012' } } },
};
const voucher = {
  voucherNumber: 'VCH-2026-27/0002', date: '2026-10-03', categoryName: 'Travel', vendor: 'Uber', description: 'Cab to GS Associates for project kick-off.',
  lines: [{ description: 'Cab — office to client', amount: 45000 }, { description: 'Cab — client to office', amount: 42000 }], amount: 87000, project: 'Website redesign', isReimbursement: true,
  reimbursement: { payeeName: 'Riya Sharma', payeeRole: 'UI Designer', status: 'reimbursed', reimbursedAt: '2026-10-04', mode: 'upi', reference: 'UPI55' },
  snapshot: { company: settings.company, reimbursedFrom: { kind: 'bank', bankName: 'Sample Bank', accountNumber: '000000005678' }, clientName: 'GS Associates' },
};

const renderers = { receipt: renderReceipt, payslip: renderPayslip, voucher: renderExpenseVoucher };
for (const [name, inv] of Object.entries({ ...samples, 'sample-receipt': { receipt }, 'sample-payslip': { payslip }, 'sample-voucher': { voucher } })) {
  const kind = Object.keys(renderers).find((k) => inv[k]);
  const html = kind ? renderers[kind](inv[kind], { settings, assets }) : renderInvoice(inv, { settings, assets });
  await fs.writeFile(path.join(outDir, `${name}.html`), html);
  await fs.writeFile(path.join(outDir, `${name}.pdf`), await renderPdf(html, { footerText: settings.invoiceDefaults.footerText, footerFontCss: footerFont }));
  console.log('wrote', name);
}
await closePdfBrowser();
