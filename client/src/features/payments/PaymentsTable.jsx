import { useNavigate } from 'react-router';
import { Paperclip, Wallet } from 'lucide-react';
import { PAYMENT_MODE_LABELS } from '@webx/shared/constants.js';
import { formatMoney } from '@webx/shared/money.js';
import { formatShortDate } from '@webx/shared/fy.js';
import { Badge, EmptyState, Pagination, QueryState, Table, Td, Th } from '@/components/ui';

const PURPOSE = { advance: 'Advance', part: 'Part', final: 'Final' };

export function PaymentsTable({ query, onPage, showClient = true, showInvoice = true, empty }) {
  const navigate = useNavigate();
  return (
    <QueryState query={query}>
      {(data) =>
        data.items.length ? (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Receipt</Th>
                  <Th>Date</Th>
                  {showClient && <Th>Client</Th>}
                  {showInvoice && <Th>Invoice</Th>}
                  <Th>Mode</Th>
                  <Th align="right">Amount</Th>
                  <Th align="right">TDS</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p._id} className={`cursor-pointer hover:bg-panel/50 ${p.status === 'void' ? 'opacity-55' : ''}`} onClick={() => navigate(`/payments/${p._id}`)}>
                    <Td className="font-mono text-[13px] font-semibold whitespace-nowrap text-ink">
                      {p.receiptNumber} {p.status === 'void' ? <Badge tone="red">Void</Badge> : p.purpose && <Badge tone={p.purpose === 'final' ? 'green' : p.purpose === 'advance' ? 'brand' : 'neutral'}>{PURPOSE[p.purpose]}</Badge>}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{formatShortDate(p.date)}</Td>
                    {showClient && <Td className="font-semibold">{p.snapshot?.client?.name}</Td>}
                    {showInvoice && <Td className="font-mono text-xs whitespace-nowrap">{p.invoiceNumber}</Td>}
                    <Td className="whitespace-nowrap text-muted">
                      {PAYMENT_MODE_LABELS[p.mode]}
                      {p.reference && <span className="block max-w-36 truncate text-xs">{p.reference}</span>}
                    </Td>
                    <Td align="right" className={`whitespace-nowrap font-semibold ${p.status === 'void' ? 'line-through' : 'text-ink'}`}>
                      {p.proof && <Paperclip className="mr-1 inline size-3 text-muted" aria-label="Has proof" />}
                      {formatMoney(p.amount, p.currency)}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-muted">{p.tds ? formatMoney(p.tds, p.currency) : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {onPage && <Pagination page={data.page} pages={data.pages} total={data.total} onPage={onPage} />}
          </>
        ) : (
          empty ?? <EmptyState icon={Wallet} title="No payments yet" />
        )
      }
    </QueryState>
  );
}
