import { useNavigate } from 'react-router';
import { UsersRound } from 'lucide-react';
import { PAYMENT_MODE_LABELS } from '@webx/shared/constants.js';
import { formatMoney } from '@webx/shared/money.js';
import { formatShortDate } from '@webx/shared/fy.js';
import { Badge, EmptyState, Pagination, QueryState, Table, Td, Th } from '@/components/ui';

export function PayoutsTable({ query, onPage, showMember = true, empty }) {
  const navigate = useNavigate();
  return (
    <QueryState query={query}>
      {(data) =>
        data.items.length ? (
          <>
            <Table>
              <thead><tr><Th>Voucher</Th><Th>Date</Th>{showMember && <Th>Paid to</Th>}<Th>Period / project</Th><Th>Mode</Th><Th align="right">Gross</Th><Th align="right">Net paid</Th></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p._id} className={`cursor-pointer hover:bg-panel/50 ${p.status === 'void' ? 'opacity-55' : ''}`} onClick={() => navigate(`/payouts/${p._id}`)}>
                    <Td className="font-mono text-[13px] font-semibold whitespace-nowrap text-ink">{p.voucherNumber} {p.status === 'void' && <Badge tone="red">Void</Badge>}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatShortDate(p.date)}</Td>
                    {showMember && <Td className="font-semibold">{p.snapshot?.member?.name}</Td>}
                    <Td className="text-muted">{[p.periodLabel, p.project].filter(Boolean).join(' · ')}</Td>
                    <Td className="text-muted">{PAYMENT_MODE_LABELS[p.mode]}</Td>
                    <Td align="right" className="text-muted">{formatMoney(p.gross + p.bonus)}</Td>
                    <Td align="right" className={`font-semibold ${p.status === 'void' ? 'line-through' : 'text-ink'}`}>{formatMoney(p.net)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {onPage && <Pagination page={data.page} pages={data.pages} total={data.total} onPage={onPage} />}
          </>
        ) : (
          empty ?? <EmptyState icon={UsersRound} title="No payouts yet" />
        )
      }
    </QueryState>
  );
}
