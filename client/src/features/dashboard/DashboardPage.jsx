import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Banknote, Landmark } from 'lucide-react';
import { LEDGER_TYPE_LABELS } from '@webx/shared/constants.js';
import { formatMoney } from '@webx/shared/money.js';
import { formatShortDate, fyLabel } from '@webx/shared/fy.js';
import { effectiveStatus } from '@webx/shared/invoiceStatus.js';
import { useBankAccounts, useDashboard, useSettings } from '@/api/hooks';
import { useAuth } from '@/features/auth/AuthContext';
import { RangePicker, rangeParams } from '@/components/RangePicker';
import { CategoryBars, ChartOrTable, IncomeExpenseChart, Legend, SERIES } from '@/components/charts';
import { InvoiceStatusBadge } from '@/features/invoices/StatusBadge';
import { presetRange } from '@/lib/ranges';
import { Badge, Card, CardHeader, EmptyState, PageHeader, QueryState, Table, Td, Th } from '@/components/ui';

const sourceLink = (r) =>
  r.sourceModel === 'Payment' ? `/payments/${r.sourceId}` : r.sourceModel === 'Payout' ? `/payouts/${r.sourceId}` : r.type === 'reimbursement' ? `/reimbursements/${r.sourceId}` : r.type === 'expense' ? `/expenses/${r.sourceId}` : '/ledger';

function Stat({ label, value, sub, tone, to }) {
  const body = (
    <div className="card h-full px-5 py-4 transition-shadow hover:shadow-md">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-black tracking-tight tabular-nums ${tone || 'text-ink'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
  return to ? <Link to={to} className="block rounded-xl focus-visible:ring-3 focus-visible:ring-brand-500/30 focus-visible:outline-none">{body}</Link> : body;
}

function Body({ data, rangeLabel }) {
  const c = data.cards;
  const m = data.monthly;
  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label={`Income · ${rangeLabel}`} value={formatMoney(c.income)} sub="Payments received + TDS" to="/payments" />
        <Stat label={`Expenses · ${rangeLabel}`} value={formatMoney(c.expenses)} sub="Expenses, reimbursements, payouts" to="/expenses" />
        <Stat label="Net profit" value={formatMoney(c.net)} tone={c.net < 0 ? 'text-red-600' : 'text-brand-600'} sub={rangeLabel} to="/reports" />
        <Stat label="Outstanding from clients" value={formatMoney(c.outstanding)} sub={c.overdue ? `${formatMoney(c.overdue)} overdue` : 'Nothing overdue'} tone={c.overdue ? 'text-amber-700' : undefined} to="/reports?tab=receivables" />
        <Stat label="Pending reimbursements" value={formatMoney(c.pendingReimbursements.amount)} sub={`${c.pendingReimbursements.count} claim${c.pendingReimbursements.count === 1 ? '' : 's'} to approve or pay`} to="/reimbursements" />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={`Income vs expenses · FY ${m.fy}`} actions={<Legend items={[{ label: 'Income', color: SERIES.income }, { label: 'Expenses', color: SERIES.expenses }]} />} />
          <div className="px-3 py-4">
            <ChartOrTable
              chart={<IncomeExpenseChart months={m.months} />}
              table={
                <Table>
                  <thead><tr><Th>Month</Th><Th align="right">Income</Th><Th align="right">Expenses</Th><Th align="right">Net</Th></tr></thead>
                  <tbody>{m.months.map((x) => <tr key={x.key}><Td>{x.label}</Td><Td align="right">{formatMoney(x.income)}</Td><Td align="right">{formatMoney(x.expenses)}</Td><Td align="right">{formatMoney(x.net)}</Td></tr>)}</tbody>
                </Table>
              }
            />
          </div>
        </Card>
        <Card>
          <CardHeader title={`Expenses by category · ${rangeLabel}`} />
          <div className="px-3 py-4">
            {data.categories.rows.length ? (
              <ChartOrTable
                chart={<CategoryBars rows={data.categories.rows} />}
                table={
                  <Table>
                    <thead><tr><Th>Category</Th><Th align="right">Amount</Th><Th align="right">Share</Th></tr></thead>
                    <tbody>{data.categories.rows.map((x) => <tr key={x.category}><Td>{x.category}</Td><Td align="right">{formatMoney(x.amount)}</Td><Td align="right">{(x.share * 100).toFixed(1)}%</Td></tr>)}</tbody>
                  </Table>
                }
              />
            ) : (
              <p className="px-2 py-10 text-center text-sm text-muted">No spending in this period.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Unpaid invoices" actions={<Link to="/invoices" className="text-xs font-semibold text-brand-600 hover:underline">All invoices</Link>} />
          {data.unpaidInvoices.length ? (
            <ul className="divide-y divide-line/50">
              {data.unpaidInvoices.map((i) => (
                <li key={i._id}>
                  <Link to={`/invoices/${i._id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-panel/50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{i.snapshot.client.name}</span>
                      <span className="font-mono text-xs text-muted">{i.number} · {i.dueDate ? `due ${formatShortDate(i.dueDate)}` : i.dueText}</span>
                    </span>
                    <InvoiceStatusBadge status={effectiveStatus(i)} />
                    <span className="w-24 text-right font-bold tabular-nums">{formatMoney(i.balanceDue, i.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="All paid up" description="No unpaid invoices." />
          )}
        </Card>
        <Card>
          <CardHeader title="Recent transactions" actions={<Link to="/ledger" className="text-xs font-semibold text-brand-600 hover:underline">Ledger</Link>} />
          {data.recent.length ? (
            <ul className="divide-y divide-line/50">
              {data.recent.map((r, idx) => (
                <li key={`${r.sourceId}-${idx}`}>
                  <Link to={sourceLink(r)} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-panel/50">
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full ${r.direction === 'in' ? 'bg-lavender text-brand-700' : 'bg-amber-50 text-amber-700'}`}>
                      {r.direction === 'in' ? <ArrowDownLeft className="size-3.5" aria-label="Money in" /> : <ArrowUpRight className="size-3.5" aria-label="Money out" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.party || r.description || LEDGER_TYPE_LABELS[r.type]}</span>
                      <span className="text-xs text-muted">{formatShortDate(r.date)} · {LEDGER_TYPE_LABELS[r.type]} · {r.accountLabel}</span>
                    </span>
                    <span className={`font-bold tabular-nums ${r.direction === 'in' ? 'text-ink' : 'text-body'}`}>{r.direction === 'in' ? '+' : '−'}{formatMoney(r.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No transactions yet" description="Payments, expenses and payouts appear here." />
          )}
        </Card>
      </div>

      {data.renewals?.length > 0 && (
        <Card className="mb-6 border-amber-200">
          <CardHeader title="Free hosting & maintenance ending" description="Offer a renewal or paid maintenance plan before these run out." />
          <ul className="divide-y divide-line/50">
            {data.renewals.map((r) => (
              <li key={`${r.invoice}-${r.kind}`}>
                <Link to={`/invoices/${r.invoice}`} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm hover:bg-panel/50">
                  <span className="min-w-0 flex-1"><span className="font-semibold">{r.clientName}</span> <span className="text-muted">· {r.kind} · invoice {r.number}</span></span>
                  <span className="text-muted">{r.daysLeft < 0 ? 'ended' : 'ends'} {formatShortDate(r.endDate)}</span>
                  <Badge tone={r.daysLeft < 0 ? 'red' : r.daysLeft <= 15 ? 'amber' : 'neutral'}>{r.daysLeft < 0 ? `${-r.daysLeft} days ago` : r.daysLeft === 0 ? 'today' : `in ${r.daysLeft} days`}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title="Account balances" actions={<Link to="/ledger" className="text-xs font-semibold text-brand-600 hover:underline">Open ledger</Link>} />
        <div className="grid gap-px bg-line/50 sm:grid-cols-2 lg:grid-cols-4">
          {data.balances.filter((a) => a.isActive).map((a) => (
            <Link key={a._id} to={`/ledger?account=${a._id}`} className="flex items-center gap-3 bg-white px-5 py-4 hover:bg-panel/50">
              <span className="grid size-9 place-items-center rounded-lg bg-lavender text-brand-600">{a.kind === 'cash' ? <Banknote className="size-4" /> : <Landmark className="size-4" />}</span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-muted">{a.label}</span>
                <span className={`block text-lg font-black tabular-nums ${a.balance < 0 ? 'text-red-600' : 'text-ink'}`}>{formatMoney(a.balance)}</span>
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}

const LABELS = { this_month: 'this month', last_month: 'last month', this_quarter: 'this quarter', this_fy: 'this FY', last_fy: 'last FY', all: 'all time', custom: 'selected dates' };

export function DashboardPage() {
  const { user, isOwner } = useAuth();
  const settings = useSettings();
  const accounts = useBankAccounts();
  const [range, setRange] = useState(() => ({ preset: 'this_month', ...presetRange('this_month') }));
  const dash = useDashboard(rangeParams(range));
  const placeholderBank = accounts.data?.some((a) => a.kind === 'bank' && a.accountNumber === '000000000000');

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(' ')[0]}`}
        description={`Financial year ${fyLabel(new Date(), settings.data?.fyStartMonth ?? 4)}`}
        actions={<RangePicker value={range} onChange={setRange} />}
      />
      {isOwner && placeholderBank && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-lavender px-5 py-4">
          <div>
            <p className="font-bold text-brand-700">Add your real bank details</p>
            <p className="text-sm text-brand-700/80">The seeded bank account is a placeholder. Invoices print whatever is saved there.</p>
          </div>
          <Link to="/settings/bank-accounts" className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline">Open bank accounts <ArrowRight className="size-4" /></Link>
        </div>
      )}
      <QueryState query={dash}>{(d) => <Body data={d} rangeLabel={LABELS[range.preset]} />}</QueryState>
    </>
  );
}
