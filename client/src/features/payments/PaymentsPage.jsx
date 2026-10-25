import { useState } from 'react';
import { Link } from 'react-router';
import { FileCheck2, Plus, Search, Wallet } from 'lucide-react';
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from '@webx/shared/constants.js';
import { formatMoney } from '@webx/shared/money.js';
import { usePayments } from '@/api/hooks';
import { useDebounced } from '@/hooks/useDebounced';
import { Button, Card, EmptyState, Input, PageHeader, Select } from '@/components/ui';
import { PaymentsTable } from './PaymentsTable';
import { RecordPaymentModal } from './RecordPaymentModal';

export function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('');
  const [status, setStatus] = useState('active');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [recording, setRecording] = useState(false);
  const q = useDebounced(search);
  const payments = usePayments({ page, limit: 25, search: q || undefined, mode: mode || undefined, status: status || undefined, from: from || undefined, to: to || undefined });
  const reset = (fn) => (e) => { fn(e.target.value); setPage(1); };
  const s = payments.data?.summary;

  return (
    <>
      <PageHeader
        title="Payments"
        description="Money received from clients. Each payment has a numbered receipt."
        actions={
          <>
            <Button variant="secondary" as={Link} to="/invoices/new?paid=1"><FileCheck2 className="size-4" /> Bill an already-paid payment</Button>
            <Button onClick={() => setRecording(true)}><Plus className="size-4" /> Record payment</Button>
          </>
        }
      />
      {s && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="card px-5 py-4"><p className="text-xs font-semibold text-muted">Received{from || to ? ' (filtered)' : ''}</p><p className="mt-1 text-xl font-black text-ink tabular-nums">{formatMoney(s.amountInr)}</p></div>
          <div className="card px-5 py-4"><p className="text-xs font-semibold text-muted">TDS deducted</p><p className="mt-1 text-xl font-black text-ink tabular-nums">{formatMoney(s.tdsInr)}</p></div>
          <div className="card px-5 py-4"><p className="text-xs font-semibold text-muted">Payments</p><p className="mt-1 text-xl font-black text-ink tabular-nums">{s.count}</p></div>
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line/60 px-5 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={reset(setSearch)} placeholder="Receipt, invoice, client, UTR" className="pl-9" aria-label="Search payments" />
          </div>
          <Select value={mode} onChange={reset(setMode)} className="w-36" aria-label="Mode">
            <option value="">All modes</option>
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>)}
          </Select>
          <Select value={status} onChange={reset(setStatus)} className="w-32" aria-label="Status">
            <option value="active">Active</option>
            <option value="void">Void</option>
            <option value="">All</option>
          </Select>
          <Input type="date" value={from} onChange={reset(setFrom)} className="w-40" aria-label="From date" />
          <Input type="date" value={to} onChange={reset(setTo)} className="w-40" aria-label="To date" />
        </div>
        <PaymentsTable
          query={payments}
          onPage={setPage}
          empty={
            <EmptyState
              icon={Wallet}
              title={q || mode || from || to ? 'No matching payments' : 'No payments yet'}
              description="Record a payment from an invoice, or here."
              action={<Button onClick={() => setRecording(true)}><Plus className="size-4" /> Record payment</Button>}
            />
          }
        />
      </Card>
      <RecordPaymentModal open={recording} onClose={() => setRecording(false)} />
    </>
  );
}
