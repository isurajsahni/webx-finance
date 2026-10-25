import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, BookOpenText, Download, FileSpreadsheet, FileText, Landmark, Plus, Search, X } from 'lucide-react';
import { LEDGER_TYPES, LEDGER_TYPE_LABELS } from '@webx/shared/constants.js';
import { formatMoney, toMinor } from '@webx/shared/money.js';
import { formatShortDate, todayISO } from '@webx/shared/fy.js';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { useBalances, useBankAccounts, useLedger, useSettings } from '@/api/hooks';
import { presetRange } from '@/lib/ranges';
import { useAuth } from '@/features/auth/AuthContext';
import { useDebounced } from '@/hooks/useDebounced';
import { RangePicker } from '@/components/RangePicker';
import { ReasonForm } from '@/features/expenses/ReasonForm';
import { moneyString } from '@/lib/validation';
import { cn } from '@/lib/cn';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, ModalFooter, MoneyInput, PageHeader, Pagination, QueryState, Select, Table, Td, Th } from '@/components/ui';

const MANUAL = [
  ['owner_investment', 'Owner investment (money in)'],
  ['owner_withdrawal', 'Owner withdrawal (money out)'],
  ['transfer', 'Transfer between accounts'],
  ['adjustment_in', 'Adjustment: money in'],
  ['adjustment_out', 'Adjustment: money out'],
];

const entrySchema = z
  .object({
    type: z.string(),
    date: z.string().min(1, 'Pick a date'),
    amount: moneyString().refine((v) => toMinor(v) > 0, 'Enter an amount'),
    account: z.string().min(1, 'Choose an account'),
    toAccount: z.string(),
    description: z.string().trim().max(300),
    reference: z.string().trim().max(80),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'transfer' && (!v.toAccount || v.toAccount === v.account)) ctx.addIssue({ code: 'custom', path: ['toAccount'], message: 'Choose a different account' });
  });

function EntryForm({ onDone, onCancel }) {
  const accounts = useBankAccounts();
  const { register, handleSubmit, control, formState, setError } = useForm({
    resolver: zodResolver(entrySchema),
    defaultValues: { type: 'owner_investment', date: todayISO(), amount: '', account: '', toAccount: '', description: '', reference: '' },
  });
  const type = useWatch({ control, name: 'type' });
  const e = formState.errors;
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        try {
          await api.post('/ledger/entries', { ...v, amount: toMinor(v.amount), toAccount: v.type === 'transfer' ? v.toAccount : null });
          onDone();
        } catch (err) {
          if (!applyServerErrors(err, setError)) setError('description', { message: errorMessage(err) });
        }
      })}
      className="space-y-4"
      noValidate
    >
      <p className="text-sm text-muted">For money movements that are not invoices, expenses or payouts. These do not count as income or expense in reports.</p>
      <Field label="Type"><Select {...register('type')}>{MANUAL.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" error={e.date?.message}><Input type="date" {...register('date')} /></Field>
        <Field label="Amount" error={e.amount?.message}><MoneyInput {...register('amount')} /></Field>
        <Field label={type === 'transfer' ? 'From account' : 'Account'} error={e.account?.message}>
          <Select {...register('account')}><option value="">Choose</option>{accounts.data?.map((a) => <option key={a._id} value={a._id}>{a.label}</option>)}</Select>
        </Field>
        {type === 'transfer' && (
          <Field label="To account" error={e.toAccount?.message}>
            <Select {...register('toAccount')}><option value="">Choose</option>{accounts.data?.map((a) => <option key={a._id} value={a._id}>{a.label}</option>)}</Select>
          </Field>
        )}
        <Field label="Reference" error={e.reference?.message}><Input {...register('reference')} /></Field>
      </div>
      <Field label="Description" error={e.description?.message}><Input {...register('description')} placeholder="e.g. Capital added, ATM withdrawal" /></Field>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={formState.isSubmitting}>Add entry</Button>
      </ModalFooter>
    </form>
  );
}

const sourceLink = (r) =>
  r.sourceModel === 'Payment' ? `/payments/${r.sourceId}` : r.sourceModel === 'Payout' ? `/payouts/${r.sourceId}` : r.type === 'reimbursement' ? `/reimbursements/${r.sourceId}` : r.type === 'expense' ? `/expenses/${r.sourceId}` : null;

export function LedgerPage() {
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const [params, setParams] = useSearchParams();
  const account = params.get('account') || '';
  const settings = useSettings();
  const [range, setRange] = useState(() => ({ preset: 'this_fy', ...presetRange('this_fy', settings.data?.fyStartMonth ?? 4) }));
  const [type, setType] = useState('');
  const [direction, setDirection] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState(null);
  const q = useDebounced(search);
  const balances = useBalances();

  const filters = { account: account || undefined, type: type || undefined, direction: direction || undefined, search: q || undefined, from: range.from || undefined, to: range.to || undefined };
  const ledger = useLedger({ ...filters, page, limit: 50 });
  const exportUrl = (format) => `/api/ledger?${new URLSearchParams(Object.entries({ ...filters, format }).filter(([, v]) => v)).toString()}`;
  const setAccount = (id) => {
    setParams(id ? { account: id } : {});
    setPage(1);
  };
  const refresh = () => ['ledger', 'dashboard', 'reports'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const d = ledger.data;

  return (
    <>
      <PageHeader
        title="Ledger"
        description="Every rupee in and out across all accounts. Built from payments, expenses, reimbursements, payouts and manual entries."
        actions={isOwner && <Button onClick={() => setAdding(true)}><Plus className="size-4" /> Manual entry</Button>}
      />

      <QueryState query={balances}>
        {(items) => (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.filter((a) => a.isActive || a._id === account).map((a) => (
              <button
                key={a._id}
                type="button"
                onClick={() => setAccount(account === a._id ? '' : a._id)}
                aria-pressed={account === a._id}
                className={cn('card flex items-center gap-3 px-4 py-3 text-left transition', account === a._id ? 'ring-2 ring-brand-500' : 'hover:shadow-md')}
              >
                <span className="grid size-9 place-items-center rounded-lg bg-lavender text-brand-600">{a.kind === 'cash' ? <Banknote className="size-4" /> : <Landmark className="size-4" />}</span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-muted">{a.label}</span>
                  <span className={`block text-lg font-black tabular-nums ${a.balance < 0 ? 'text-red-600' : 'text-ink'}`}>{formatMoney(a.balance)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </QueryState>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line/60 px-5 py-3">
          <div className="relative w-full max-w-60">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Party, doc no., ref" className="pl-9" aria-label="Search ledger" />
          </div>
          <RangePicker value={range} onChange={(r) => { setRange(r); setPage(1); }} />
          <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="w-44" aria-label="Type">
            <option value="">All types</option>
            {LEDGER_TYPES.map((t) => <option key={t} value={t}>{LEDGER_TYPE_LABELS[t]}</option>)}
          </Select>
          <Select value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }} className="w-32" aria-label="Direction">
            <option value="">In & out</option><option value="in">Money in</option><option value="out">Money out</option>
          </Select>
          {account && (
            <button type="button" onClick={() => setAccount('')} className="inline-flex items-center gap-1 rounded-full bg-lavender px-2.5 py-1 text-xs font-semibold text-brand-700">
              {balances.data?.find((a) => a._id === account)?.label} <X className="size-3" aria-label="Clear account filter" />
            </button>
          )}
          <div className="ml-auto flex gap-1">
            <Button as="a" href={exportUrl('csv')} variant="ghost" size="sm" title="Export CSV"><Download className="size-3.5" /> CSV</Button>
            <Button as="a" href={exportUrl('xlsx')} variant="ghost" size="sm" title="Export Excel"><FileSpreadsheet className="size-3.5" /> Excel</Button>
            <Button as="a" href={exportUrl('pdf')} variant="ghost" size="sm" title="Export PDF"><FileText className="size-3.5" /> PDF</Button>
          </div>
        </div>

        {d && (
          <div className="flex flex-wrap gap-x-8 gap-y-1 border-b border-line/60 bg-panel/40 px-5 py-2.5 text-sm">
            {d.openingBalance !== null && <span><span className="text-muted">Opening </span><b className="tabular-nums">{formatMoney(d.openingBalance)}</b></span>}
            <span><span className="text-muted">In </span><b className="text-brand-700 tabular-nums">+{formatMoney(d.totals.in)}</b></span>
            <span><span className="text-muted">Out </span><b className="tabular-nums">−{formatMoney(d.totals.out)}</b></span>
            <span><span className="text-muted">Net </span><b className="tabular-nums">{formatMoney(d.totals.net)}</b></span>
            {d.closingBalance !== null && <span><span className="text-muted">Closing </span><b className="tabular-nums">{formatMoney(d.closingBalance)}</b></span>}
            {!account && <span className="text-xs text-muted">Pick an account above to see its running balance.</span>}
          </div>
        )}

        <QueryState query={ledger}>
          {(data) =>
            data.items.length ? (
              <>
                <Table>
                  <thead>
                    <tr><Th>Date</Th><Th>Type</Th><Th>Details</Th><Th>Account</Th><Th align="right">In</Th><Th align="right">Out</Th>{account && <Th align="right">Balance</Th>}</tr>
                  </thead>
                  <tbody>
                    {data.items.map((r, i) => {
                      const link = sourceLink(r);
                      return (
                        <tr key={`${r.sourceId}-${r.direction}-${i}`} className="hover:bg-panel/40">
                          <Td className="whitespace-nowrap text-muted">{formatShortDate(r.date)}</Td>
                          <Td><Badge tone={r.direction === 'in' ? 'brand' : 'neutral'}>{LEDGER_TYPE_LABELS[r.type]}</Badge></Td>
                          <Td>
                            <p className="max-w-72 truncate font-semibold">{r.party || r.description || '—'}</p>
                            <p className="max-w-72 truncate text-xs text-muted">
                              {link ? <Link to={link} className="font-mono text-brand-600 hover:underline">{r.docNumber}</Link> : null}
                              {[r.party && r.description, r.categoryName, r.reference].filter(Boolean).map((x) => ` · ${x}`).join('')}
                              {r.sourceModel === 'LedgerEntry' && isOwner && (
                                <button type="button" className="ml-2 font-semibold text-red-600 hover:underline" onClick={() => setVoiding(r.sourceId)}>Void</button>
                              )}
                            </p>
                          </Td>
                          <Td className="whitespace-nowrap text-muted">{r.accountLabel}</Td>
                          <Td align="right" className="font-semibold text-brand-700">{r.direction === 'in' ? formatMoney(r.amount) : ''}</Td>
                          <Td align="right" className="font-semibold">{r.direction === 'out' ? formatMoney(r.amount) : ''}</Td>
                          {account && <Td align="right" className={r.balance < 0 ? 'text-red-600' : 'text-muted'}>{formatMoney(r.balance)}</Td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
              </>
            ) : (
              <EmptyState icon={BookOpenText} title="No transactions" description="Nothing matches these filters." />
            )
          }
        </QueryState>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Manual ledger entry" size="md">
        {adding && <EntryForm onCancel={() => setAdding(false)} onDone={() => { setAdding(false); refresh(); toast.success('Entry added'); }} />}
      </Modal>
      <Modal open={!!voiding} onClose={() => setVoiding(null)} title="Void manual entry?" size="sm">
        {voiding && <ReasonForm url={`/ledger/entries/${voiding}/void`} confirmLabel="Void entry" onCancel={() => setVoiding(null)} onDone={() => { setVoiding(null); refresh(); toast.success('Entry voided'); }} />}
      </Modal>
    </>
  );
}
