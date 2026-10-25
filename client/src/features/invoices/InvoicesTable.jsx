import { useNavigate } from 'react-router';
import { FileText } from 'lucide-react';
import { formatMoney } from '@webx/shared/money.js';
import { formatShortDate } from '@webx/shared/fy.js';
import { EmptyState, Pagination, QueryState, Table, Td, Th } from '@/components/ui';
import { InvoiceStatusBadge } from './StatusBadge';

export function InvoicesTable({ query, onPage, showClient = true, empty }) {
  const navigate = useNavigate();
  return (
    <QueryState query={query}>
      {(data) =>
        data.items.length ? (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Number</Th>
                  {showClient && <Th>Client</Th>}
                  <Th>Date</Th>
                  <Th>Due</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Balance</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((inv) => (
                  <tr key={inv._id} className="cursor-pointer hover:bg-panel/50" onClick={() => navigate(`/invoices/${inv._id}`)}>
                    <Td className="font-mono text-[13px] font-semibold whitespace-nowrap text-ink">{inv.number || <span className="font-sans font-normal text-muted italic">Draft</span>}</Td>
                    {showClient && (
                      <Td>
                        <p className="font-semibold">{inv.snapshot?.client?.name}</p>
                        <p className="max-w-56 truncate text-xs text-muted">{inv.items?.[0]?.title}</p>
                      </Td>
                    )}
                    <Td className="whitespace-nowrap text-muted">{formatShortDate(inv.issueDate)}</Td>
                    <Td className="whitespace-nowrap text-muted">{inv.dueDate ? formatShortDate(inv.dueDate) : inv.dueText || '—'}</Td>
                    <Td align="right" className="whitespace-nowrap">{formatMoney(inv.total, inv.currency)}</Td>
                    <Td align="right" className={`whitespace-nowrap ${inv.balanceDue > 0 && inv.status !== 'draft' && inv.status !== 'cancelled' ? 'font-bold text-ink' : 'text-muted'}`}>
                      {inv.status === 'cancelled' ? '—' : formatMoney(inv.balanceDue, inv.currency)}
                    </Td>
                    <Td><InvoiceStatusBadge status={inv.displayStatus} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} pages={data.pages} total={data.total} onPage={onPage} />
          </>
        ) : (
          empty ?? <EmptyState icon={FileText} title="No invoices" />
        )
      }
    </QueryState>
  );
}
