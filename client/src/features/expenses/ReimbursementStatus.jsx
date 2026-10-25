import { REIMBURSEMENT_STATUS_LABELS } from '@webx/shared/constants.js';
import { Badge } from '@/components/ui';

const TONE = { submitted: 'amber', approved: 'brand', reimbursed: 'green', rejected: 'neutral' };

export function ReimbursementBadge({ doc }) {
  if (doc.status === 'void') return <Badge tone="red">Void</Badge>;
  const s = doc.reimbursement?.status;
  return <Badge tone={TONE[s]}>{REIMBURSEMENT_STATUS_LABELS[s]}</Badge>;
}
