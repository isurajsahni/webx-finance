import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Ban, Download, ExternalLink, Pencil, Repeat } from 'lucide-react';
import { PAYMENT_MODE_LABELS } from '@webx/shared/constants.js';
import { formatMoney } from '@webx/shared/money.js';
import { formatLongDate, formatShortDate } from '@webx/shared/fy.js';
import { renderExpenseVoucher } from '@webx/shared/templates/index.js';
import { api } from '@/api/client';
import { useApiMutation, useExpense, useSettings } from '@/api/hooks';
import { useAuth } from '@/features/auth/AuthContext';
import { DocumentPreview } from '@/components/DocumentPreview';
import { FilesField } from '@/components/FilesField';
import { previewAssets } from '@/lib/documentAssets';
import { Badge, Button, Card, CardHeader, Modal, QueryState } from '@/components/ui';
import { ExpenseForm } from './ExpenseForm';
import { ReasonForm } from './ReasonForm';

function View({ expense, settings }) {
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const [editing, setEditing] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const assets = useMemo(() => previewAssets(settings), [settings]);
  const html = useMemo(() => renderExpenseVoucher(expense, { settings, assets }), [expense, settings, assets]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['expenses'] });
  const next = useApiMutation(() => api.post(`/expenses/${expense._id}/record-next`), {
    invalidate: [['expenses']],
    success: (r) => `Recorded ${r.data.expense.voucherNumber} for ${formatShortDate(r.data.expense.date)}`,
  });
  const url = `/api/expenses/${expense._id}/voucher`;
  const isVoid = expense.status === 'void';

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/expenses" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-body"><ArrowLeft className="size-3.5" /> Expenses</Link>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-black tracking-tight text-ink">
            <span className="font-mono">{expense.voucherNumber}</span>
            {isVoid ? <Badge tone="red">Void</Badge> : <Badge tone="green">Paid</Badge>}
            {expense.recurring?.enabled && <Badge tone="brand"><Repeat className="mr-1 size-3" /> {expense.recurring.interval}</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted"><b className="text-body">{expense.vendor}</b> · {expense.categoryName} · {formatLongDate(expense.date)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button as="a" href={`${url}?download=1`}><Download className="size-4" /> Download voucher</Button>
          <Button as="a" href={url} target="_blank" rel="noreferrer" variant="secondary"><ExternalLink className="size-4" /> Open PDF</Button>
          {!isVoid && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit</Button>}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <DocumentPreview html={html} debounce={0} />
        <div className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="space-y-2 px-5 py-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Amount</dt><dd className="font-bold tabular-nums">{formatMoney(expense.amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Mode</dt><dd>{PAYMENT_MODE_LABELS[expense.mode]}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">From</dt><dd>{expense.paidFrom?.label}</dd></div>
              {expense.reference && <div className="flex justify-between gap-3"><dt className="text-muted">Reference</dt><dd className="truncate font-mono text-xs">{expense.reference}</dd></div>}
              {expense.client && <div className="flex justify-between"><dt className="text-muted">Client</dt><dd><Link className="text-brand-600 hover:underline" to={`/clients/${expense.client._id}`}>{expense.client.name}</Link></dd></div>}
              {expense.recurring?.enabled && <div className="flex justify-between"><dt className="text-muted">Next due</dt><dd>{formatShortDate(expense.recurring.nextDueDate)}</dd></div>}
            </dl>
            {expense.recurring?.enabled && !isVoid && (
              <div className="border-t border-line/60 p-4">
                <Button variant="dark" className="w-full" onClick={() => next.mutate()} loading={next.isPending}><Repeat className="size-4" /> Record next ({formatShortDate(expense.recurring.nextDueDate)})</Button>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Bills" />
            <div className="px-5 py-4 text-sm">
              {expense.bills?.length ? <FilesField existing={expense.bills} files={[]} onFiles={() => {}} max={0} /> : <p className="text-muted">No bills attached. Use Edit to add one.</p>}
            </div>
          </Card>
          {isVoid ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">Voided: {expense.voidReason}</p>
          ) : (
            isOwner && <Button variant="ghost" className="w-full text-red-600 hover:bg-red-50" onClick={() => setVoiding(true)}><Ban className="size-4" /> Void expense</Button>
          )}
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${expense.voucherNumber}`} size="lg">
        {editing && <ExpenseForm doc={expense} onCancel={() => setEditing(false)} onDone={() => { setEditing(false); refresh(); toast.success('Expense saved'); }} />}
      </Modal>
      <Modal open={voiding} onClose={() => setVoiding(false)} title={`Void ${expense.voucherNumber}?`} size="sm">
        {voiding && (
          <ReasonForm
            url={`/expenses/${expense._id}/void`}
            intro="The expense stays on file marked Void and is left out of totals. Its voucher number is not reused."
            confirmLabel="Void expense"
            onCancel={() => setVoiding(false)}
            onDone={() => { setVoiding(false); refresh(); toast.success('Expense voided'); }}
          />
        )}
      </Modal>
    </>
  );
}

export function ExpenseViewPage() {
  const { id } = useParams();
  const expense = useExpense(id);
  const settings = useSettings();
  return <QueryState query={settings}>{(s) => <QueryState query={expense}>{(x) => <View expense={x} settings={s} />}</QueryState>}</QueryState>;
}
