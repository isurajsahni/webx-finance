import { INVOICE_STATUS_LABELS } from '@webx/shared/invoiceStatus.js';
import { Badge } from '@/components/ui';

const TONE = { draft: 'neutral', sent: 'brand', partly_paid: 'amber', paid: 'green', overdue: 'red', cancelled: 'dark' };

export function InvoiceStatusBadge({ status }) {
  return <Badge tone={TONE[status] || 'neutral'}>{INVOICE_STATUS_LABELS[status] || status}</Badge>;
}
