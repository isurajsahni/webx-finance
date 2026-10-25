import { Badge } from '@/components/ui';

const MAP = { draft: ['neutral', 'Draft'], sent: ['brand', 'Sent'], accepted: ['green', 'Accepted'], declined: ['red', 'Declined'], converted: ['dark', 'Invoiced'], expired: ['amber', 'Expired'] };

export function QuoteStatusBadge({ status }) {
  const [tone, label] = MAP[status] || ['neutral', status];
  return <Badge tone={tone}>{label}</Badge>;
}
