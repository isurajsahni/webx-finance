import { useState } from 'react';
import { Link } from 'react-router';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { formatMoney } from '@webx/shared/money.js';
import { formatShortDate } from '@webx/shared/fy.js';
import { useClientStatement } from '@/api/hooks';
import { RangePicker, rangeParams } from '@/components/RangePicker';
import { Button, Card, CardHeader, QueryState, Table, Td, Th } from '@/components/ui';

/** Statement of account: invoices and payments with a running balance. */
export function StatementCard({ client }) {
  const [range, setRange] = useState({ preset: 'all', from: '', to: '' });
  const params = rangeParams(range);
  const statement = useClientStatement(client._id, params);
  const url = (format) => `/api/clients/${client._id}/statement?${new URLSearchParams(Object.entries({ ...params, format }).filter(([, v]) => v)).toString()}`;

  return (
    <Card>
      <CardHeader
        title="Statement of account"
        description="Every invoice and payment, so you and the client see exactly what is due."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RangePicker value={range} onChange={setRange} />
            <Button as="a" href={url('pdf')} size="sm"><FileText className="size-3.5" /> PDF</Button>
            <Button as="a" href={url('csv')} size="sm" variant="ghost"><Download className="size-3.5" /> CSV</Button>
            <Button as="a" href={url('xlsx')} size="sm" variant="ghost"><FileSpreadsheet className="size-3.5" /> Excel</Button>
          </div>
        }
      />
      <QueryState query={statement}>
        {(d) =>
          d.rows.length || d.opening ? (
            <Table>
              <thead>
                <tr><Th>Date</Th><Th>Number</Th><Th>Details</Th><Th align="right">Invoiced</Th><Th align="right">Received</Th><Th align="right">Balance</Th></tr>
              </thead>
              <tbody>
                {(range.from || d.opening !== 0) && (
                  <tr className="bg-panel/50"><Td colSpan={5} className="text-muted">Opening balance</Td><Td align="right" className="font-semibold">{formatMoney(d.opening)}</Td></tr>
                )}
                {d.rows.map((r, i) => (
                  <tr key={`${r.ref}-${r.type}-${i}`}>
                    <Td className="whitespace-nowrap text-muted">{formatShortDate(r.date)}</Td>
                    <Td><Link to={r.link} className="font-mono text-xs font-semibold text-brand-600 hover:underline">{r.ref}</Link></Td>
                    <Td className="max-w-72 truncate">{r.description}</Td>
                    <Td align="right">{r.debit ? formatMoney(r.debit) : ''}</Td>
                    <Td align="right" className="text-brand-700">{r.credit ? formatMoney(r.credit) : ''}</Td>
                    <Td align="right" className="font-semibold">{formatMoney(r.balance)}</Td>
                  </tr>
                ))}
                <tr className="bg-lavender font-bold text-ink">
                  <Td colSpan={3}>{d.closing > 0 ? 'Balance due' : d.closing < 0 ? 'In credit' : 'Fully settled'}</Td>
                  <Td align="right">{formatMoney(d.totals.debit)}</Td>
                  <Td align="right">{formatMoney(d.totals.credit)}</Td>
                  <Td align="right">{formatMoney(Math.abs(d.closing))}</Td>
                </tr>
              </tbody>
            </Table>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">No invoices or payments in this period.</p>
          )
        }
      </QueryState>
    </Card>
  );
}
