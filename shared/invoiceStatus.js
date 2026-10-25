export const INVOICE_STATUSES = ['draft', 'sent', 'partly_paid', 'paid', 'overdue', 'cancelled'];

export const INVOICE_STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  partly_paid: 'Partly paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

/**
 * Status shown to people. Stored status is draft/sent/partly_paid/paid/cancelled;
 * "overdue" is derived: unpaid past a real due date.
 */
export function effectiveStatus(inv, today = new Date()) {
  if (!inv) return 'draft';
  if (inv.status === 'cancelled' || inv.status === 'paid' || inv.status === 'draft') return inv.status;
  if (inv.dueDate && new Date(inv.dueDate) < startOfUtcDay(today) && (inv.balanceDue ?? 1) > 0) return 'overdue';
  return inv.status;
}

export function startOfUtcDay(d = new Date()) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}
