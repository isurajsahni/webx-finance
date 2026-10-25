import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { HandCoins, Paperclip, Plus, Search } from 'lucide-react';
import { formatMoney } from '@webx/shared/money.js';
import { formatShortDate } from '@webx/shared/fy.js';
import { useReimbursements } from '@/api/hooks';
import { useDebounced } from '@/hooks/useDebounced';
import { cn } from '@/lib/cn';
import { Button, Card, EmptyState, Input, Modal, PageHeader, Pagination, QueryState, Table, Td, Th } from '@/components/ui';
import { ExpenseForm } from './ExpenseForm';
import { ReimbursementBadge } from './ReimbursementStatus';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'To approve' },
  { value: 'approved', label: 'To pay' },
  { value: 'reimbursed', label: 'Reimbursed' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

export function ReimbursementsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const q = useDebounced(search);
  const claims = useReimbursements({ page, limit: 25, search: q || undefined, reimbursementStatus: tab || undefined, status: tab ? 'active' : undefined });

  return (
    <>
      <PageHeader
        title="Reimbursements"
        description="Business costs paid personally by you or a team member: submit → approve → reimburse."
        actions={<Button onClick={() => setAdding(true)}><Plus className="size-4" /> New claim</Button>}
      />
      {claims.data && tab === 'pending' && claims.data.summary.count > 0 && (
        <div className="mb-6 card flex items-center justify-between px-5 py-4">
          <p className="text-sm font-semibold text-muted">Pending reimbursements</p>
          <p className="text-xl font-black text-brand-600 tabular-nums">{formatMoney(claims.data.summary.amount)}</p>
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 px-5 py-3">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist">
            {TABS.map((t) => (
              <button key={t.value} role="tab" aria-selected={tab === t.value} onClick={() => { setTab(t.value); setPage(1); }}
                className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap', tab === t.value ? 'bg-ink text-white' : 'text-muted hover:bg-panel hover:text-body')}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Person, vendor, voucher" className="pl-9" aria-label="Search claims" />
          </div>
        </div>
        <QueryState query={claims}>
          {(data) =>
            data.items.length ? (
              <>
                <Table>
                  <thead><tr><Th>Date</Th><Th>Paid by</Th><Th>For</Th><Th>Category</Th><Th>Status</Th><Th align="right">Amount</Th></tr></thead>
                  <tbody>
                    {data.items.map((x) => (
                      <tr key={x._id} className={`cursor-pointer hover:bg-panel/50 ${x.status === 'void' ? 'opacity-55' : ''}`} onClick={() => navigate(`/reimbursements/${x._id}`)}>
                        <Td className="whitespace-nowrap text-muted">{formatShortDate(x.date)}</Td>
                        <Td className="font-semibold">{x.reimbursement.payeeName}</Td>
                        <Td>
                          <p className="max-w-60 truncate">{x.lines?.[0]?.description || x.description || x.vendor}</p>
                          {x.vendor && <p className="text-xs text-muted">{x.vendor}</p>}
                        </Td>
                        <Td className="text-muted">{x.categoryName}</Td>
                        <Td><ReimbursementBadge doc={x} />{x.voucherNumber && <span className="ml-2 font-mono text-xs text-muted">{x.voucherNumber}</span>}</Td>
                        <Td align="right" className="whitespace-nowrap font-semibold text-ink">
                          {x.bills?.length > 0 && <Paperclip className="mr-1 inline size-3 text-muted" aria-label="Has bill" />}
                          {formatMoney(x.amount)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
              </>
            ) : (
              <EmptyState icon={HandCoins} title={tab === 'pending' ? 'Nothing pending' : 'No claims here'} description="Paid for something yourself? Submit a claim with the bill." action={<Button onClick={() => setAdding(true)}><Plus className="size-4" /> New claim</Button>} />
            )
          }
        </QueryState>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="New reimbursement claim" size="lg">
        {adding && (
          <ExpenseForm
            kind="reimbursement"
            onCancel={() => setAdding(false)}
            onDone={(x) => {
              setAdding(false);
              qc.invalidateQueries({ queryKey: ['reimbursements'] });
              toast.success('Claim submitted');
              navigate(`/reimbursements/${x._id}`);
            }}
          />
        )}
      </Modal>
    </>
  );
}
