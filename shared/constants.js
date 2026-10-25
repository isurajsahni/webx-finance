export const CURRENCIES = ['INR', 'USD', 'GBP', 'EUR', 'AED'];

export const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', GBP: '£', EUR: '€', AED: 'AED ' };

export const ROLES = ['owner', 'accountant'];

export const PAYMENT_MODES = ['upi', 'bank_transfer', 'cash', 'cheque', 'card', 'other'];

export const PAYMENT_MODE_LABELS = {
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
};

/** Document types that get their own number series. */
export const DOC_TYPES = ['invoice', 'quote', 'receipt', 'payslip', 'voucher'];

export const DOC_TYPE_LABELS = {
  invoice: 'Invoice',
  quote: 'Quotation',
  receipt: 'Receipt',
  payslip: 'Payslip / payment voucher',
  voucher: 'Expense / reimbursement voucher',
};

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Software & Subscriptions',
  'Hosting & Domains',
  'Hardware & Equipment',
  'Office & Management',
  'Marketing & Ads',
  'Travel',
  'Freelancer/Contractor',
  'Taxes & Fees',
  'Miscellaneous',
];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MEMBER_TYPES = ['employee', 'freelancer'];
export const PAY_BASIS = ['monthly', 'per_project'];
export const REIMBURSEMENT_STATUSES = ['submitted', 'approved', 'reimbursed', 'rejected'];
export const REIMBURSEMENT_STATUS_LABELS = { submitted: 'Submitted', approved: 'Approved', reimbursed: 'Reimbursed', rejected: 'Rejected' };
export const RECURRING_INTERVALS = ['monthly', 'yearly'];

export const LEDGER_TYPES = ['invoice_payment', 'payout', 'expense', 'reimbursement', 'owner_investment', 'owner_withdrawal', 'transfer', 'adjustment_in', 'adjustment_out'];
export const LEDGER_TYPE_LABELS = {
  invoice_payment: 'Client payment',
  payout: 'Team payout',
  expense: 'Expense',
  reimbursement: 'Reimbursement',
  owner_investment: 'Owner investment',
  owner_withdrawal: 'Owner withdrawal',
  transfer: 'Transfer',
  adjustment_in: 'Adjustment (in)',
  adjustment_out: 'Adjustment (out)',
};
