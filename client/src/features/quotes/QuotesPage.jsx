import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { FileSignature, Plus, Search } from 'lucide-react';
import { formatMoney } from '@webx/shared/money.js';
import { formatShortDate } from '@webx/shared/fy.js';
import { useQuotes } from '@/api/hooks';
import { useDebounced } from '@/hooks/useDebounced';
import { cn } from '@/lib/cn';
import { Button, Card, EmptyState, Input, PageHeader, Pagination, QueryState, Table, Td, Th } from '@/components/ui';
import { QuoteStatusBadge } from './QuoteStatusBadge';

const TABS = [['', 'All'], ['open', 'Open'], ['draft', 'Drafts'], ['sent', 'Sent'], ['accepted', 'Accepted'], ['converted', 'Invoiced'], ['expired', 'Expired'], ['declined', 'Declined']];

export function QuotesPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const quotes = useQuotes({ page, limit: 25, status: status || undefined, search: q || undefined });

  return (
    <>
      <PageHeader title="Quotes" description="Send a quotation; when the client accepts, turn it into an invoice in one click." actions={<Button as={Link} to="/quotes/new"><Plus className="size-4" /> New quote</Button>} />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 px-5 py-3">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist">
            {TABS.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={status === k} onClick={() => { setStatus(k); setPage(1); }} className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap', status === k ? 'bg-ink text-white' : 'text-muted hover:bg-panel hover:text-body')}>{l}</button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Number, client or item" className="pl-9" aria-label="Search quotes" />
          </div>
        </div>
        <QueryState query={quotes}>
          {(d) =>
            d.items.length ? (
              <>
                <Table>
                  <thead><tr><Th>Number</Th><Th>Client</Th><Th>Date</Th><Th>Valid until</Th><Th align="right">Total</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {d.items.map((x) => (
                      <tr key={x._id} className="cursor-pointer hover:bg-panel/50" onClick={() => navigate(`/quotes/${x._id}`)}>
                        <Td className="font-mono text-[13px] font-semibold whitespace-nowrap text-ink">{x.number || <span className="font-sans font-normal text-muted italic">Draft</span>}</Td>
                        <Td><p className="font-semibold">{x.snapshot?.client?.name}</p><p className="max-w-56 truncate text-xs text-muted">{x.items?.[0]?.title}</p></Td>
                        <Td className="whitespace-nowrap text-muted">{formatShortDate(x.issueDate)}</Td>
                        <Td className="whitespace-nowrap text-muted">{formatShortDate(x.validUntil)}</Td>
                        <Td align="right" className="font-semibold whitespace-nowrap">{formatMoney(x.total, x.currency)}</Td>
                        <Td><QuoteStatusBadge status={x.displayStatus} />{x.invoiceNumber && <span className="ml-2 font-mono text-xs text-muted">→ {x.invoiceNumber}</span>}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} />
              </>
            ) : (
              <EmptyState icon={FileSignature} title={q || status ? 'No matching quotes' : 'No quotes yet'} description="Quote a project before starting. Accepted quotes convert into invoices." action={!q && !status && <Button as={Link} to="/quotes/new"><Plus className="size-4" /> New quote</Button>} />
            )
          }
        </QueryState>
      </Card>
    </>
  );
}
