import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Paperclip, Plus, Receipt, Repeat, Search } from 'lucide-react';
import { formatMoney } from '@webx/shared/money.js';
import { formatShortDate } from '@webx/shared/fy.js';
import { api } from '@/api/client';
import { useApiMutation, useBankAccounts, useExpenseCategories, useExpenses, useRecurringDue } from '@/api/hooks';
import { useDebounced } from '@/hooks/useDebounced';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Pagination, QueryState, Select, Table, Td, Th } from '@/components/ui';
import { ExpenseForm } from './ExpenseForm';

function RecurringDue() {
  const due = useRecurringDue();
  const record = useApiMutation((id) => api.post(`/expenses/${id}/record-next`), {
    invalidate: [['expenses']],
    success: (r) => `Recorded ${r.data.expense.voucherNumber} · ${formatMoney(r.data.expense.amount)}`,
  });
  if (!due.data?.length) return null;
  return (
    <Card className="mb-6 border-brand-200">
      <div className="flex items-center gap-2 border-b border-line/60 px-5 py-3">
        <CalendarClock className="size-4 text-brand-600" />
        <p className="text-sm font-bold text-ink">Subscriptions due</p>
        <span className="text-xs text-muted">within 7 days or overdue</span>
      </div>
      <ul className="divide-y divide-line/50">
        {due.data.map((x) => (
          <li key={x._id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
            <span className="flex-1 font-semibold">{x.vendor} <span className="font-normal text-muted">· {x.categoryName}</span></span>
            <span className="text-muted">due {formatShortDate(x.recurring.nextDueDate)}</span>
            <span className="w-24 text-right font-bold tabular-nums">{formatMoney(x.amount)}</span>
            <Button size="sm" variant="dark" onClick={() => record.mutate(x._id)} loading={record.isPending && record.variables === x._id}>Record</Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ExpensesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [paidFrom, setPaidFrom] = useState('');
  const [status, setStatus] = useState('active');
  const [recurring, setRecurring] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [adding, setAdding] = useState(false);
  const q = useDebounced(search);
  const categories = useExpenseCategories({ includeInactive: true });
  const accounts = useBankAccounts({ includeInactive: true });
  const expenses = useExpenses({
    page, limit: 25, search: q || undefined, category: category || undefined, paidFrom: paidFrom || undefined,
    status: status || undefined, recurring: recurring || undefined, from: from || undefined, to: to || undefined,
  });
  const reset = (fn) => (e) => { fn(e.target.value); setPage(1); };
  const filtered = q || category || paidFrom || recurring || from || to;

  return (
    <>
      <PageHeader title="Expenses" description="Money the studio spent: tools, hosting, rent, ads, contractors." actions={<Button onClick={() => setAdding(true)}><Plus className="size-4" /> Add expense</Button>} />
      <RecurringDue />
      {expenses.data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="card px-5 py-4"><p className="text-xs font-semibold text-muted">Total{filtered ? ' (filtered)' : ''}</p><p className="mt-1 text-xl font-black text-ink tabular-nums">{formatMoney(expenses.data.summary.amount)}</p></div>
          <div className="card px-5 py-4"><p className="text-xs font-semibold text-muted">Expenses</p><p className="mt-1 text-xl font-black text-ink tabular-nums">{expenses.data.summary.count}</p></div>
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line/60 px-5 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={reset(setSearch)} placeholder="Vendor, voucher, note" className="pl-9" aria-label="Search expenses" />
          </div>
          <Select value={category} onChange={reset(setCategory)} className="w-48" aria-label="Category">
            <option value="">All categories</option>
            {categories.data?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
          <Select value={paidFrom} onChange={reset(setPaidFrom)} className="w-44" aria-label="Paid from">
            <option value="">All accounts</option>
            {accounts.data?.map((a) => <option key={a._id} value={a._id}>{a.label}</option>)}
          </Select>
          <Select value={recurring} onChange={reset(setRecurring)} className="w-36" aria-label="Recurring">
            <option value="">All</option>
            <option value="1">Recurring</option>
          </Select>
          <Select value={status} onChange={reset(setStatus)} className="w-28" aria-label="Status">
            <option value="active">Active</option>
            <option value="void">Void</option>
            <option value="">All</option>
          </Select>
          <Input type="date" value={from} onChange={reset(setFrom)} className="w-40" aria-label="From date" />
          <Input type="date" value={to} onChange={reset(setTo)} className="w-40" aria-label="To date" />
        </div>
        <QueryState query={expenses}>
          {(data) =>
            data.items.length ? (
              <>
                <Table>
                  <thead>
                    <tr><Th>Voucher</Th><Th>Date</Th><Th>Paid to</Th><Th>Category</Th><Th>From</Th><Th align="right">Amount</Th></tr>
                  </thead>
                  <tbody>
                    {data.items.map((x) => (
                      <tr key={x._id} className={`cursor-pointer hover:bg-panel/50 ${x.status === 'void' ? 'opacity-55' : ''}`} onClick={() => navigate(`/expenses/${x._id}`)}>
                        <Td className="font-mono text-[13px] font-semibold whitespace-nowrap text-ink">{x.voucherNumber} {x.status === 'void' && <Badge tone="red">Void</Badge>}</Td>
                        <Td className="whitespace-nowrap text-muted">{formatShortDate(x.date)}</Td>
                        <Td>
                          <p className="font-semibold">{x.vendor} {x.recurring?.enabled && <Repeat className="inline size-3.5 text-brand-500" aria-label="Recurring" />}</p>
                          <p className="max-w-60 truncate text-xs text-muted">{x.lines?.[0]?.description || x.description}</p>
                        </Td>
                        <Td className="text-muted">{x.categoryName}</Td>
                        <Td className="whitespace-nowrap text-muted">{x.paidFrom?.label}</Td>
                        <Td align="right" className={`whitespace-nowrap font-semibold ${x.status === 'void' ? 'line-through' : 'text-ink'}`}>
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
              <EmptyState icon={Receipt} title={filtered ? 'No matching expenses' : 'No expenses yet'} action={!filtered && <Button onClick={() => setAdding(true)}><Plus className="size-4" /> Add expense</Button>} />
            )
          }
        </QueryState>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add expense" size="lg">
        {adding && (
          <ExpenseForm
            onCancel={() => setAdding(false)}
            onDone={(x) => {
              setAdding(false);
              qc.invalidateQueries({ queryKey: ['expenses'] });
              toast.success(`Expense ${x.voucherNumber} added`);
            }}
          />
        )}
      </Modal>
    </>
  );
}
