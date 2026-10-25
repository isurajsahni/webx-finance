import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Ban, Copy, Download, ExternalLink, Lock, Pencil, Send, Wallet } from 'lucide-react';
import { formatMoney } from '@webx/shared/money.js';
import { formatLongDate } from '@webx/shared/fy.js';
import { renderInvoice } from '@webx/shared/templates/index.js';
import { api, errorMessage } from '@/api/client';
import { useApiMutation, useInvoice, usePayments, useSettings } from '@/api/hooks';
import { RecordPaymentModal } from '@/features/payments/RecordPaymentModal';
import { PaymentsTable } from '@/features/payments/PaymentsTable';
import { useAuth } from '@/features/auth/AuthContext';
import { DocumentPreview } from '@/components/DocumentPreview';
import { previewAssets } from '@/lib/documentAssets';
import { Button, Card, CardHeader, Field, Modal, ModalFooter, QueryState, Textarea } from '@/components/ui';
import { InvoiceStatusBadge } from './StatusBadge';
import { HandoverPanel } from './HandoverPanel';

const cancelSchema = z.object({ reason: z.string().trim().min(3, 'Give a reason (min 3 characters)').max(500) });

function CancelForm({ invoice, onDone, onCancel }) {
  const { register, handleSubmit, formState, setError } = useForm({ resolver: zodResolver(cancelSchema), defaultValues: { reason: '' } });
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        try {
          await api.post(`/invoices/${invoice._id}/cancel`, v);
          onDone();
        } catch (err) {
          setError('reason', { message: errorMessage(err) });
        }
      })}
      noValidate
    >
      <p className="mb-4 text-sm text-muted">
        The invoice stays in your records marked <b>Cancelled</b>, and its number <span className="font-mono">{invoice.number}</span> will not be reused.
      </p>
      <Field label="Reason" required error={formState.errors.reason?.message}>
        <Textarea rows={3} {...register('reason')} autoFocus />
      </Field>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>Keep invoice</Button>
        <Button variant="danger" type="submit" loading={formState.isSubmitting}>Cancel invoice</Button>
      </ModalFooter>
    </form>
  );
}

function Row({ label, children, strong }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? 'font-bold text-ink' : ''}`}>{children}</dd>
    </div>
  );
}

function View({ invoice, settings }) {
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const [cancelling, setCancelling] = useState(false);
  const [recording, setRecording] = useState(false);
  const payments = usePayments({ invoice: invoice._id, status: '', limit: 50 });
  const assets = useMemo(() => previewAssets(settings), [settings]);
  // The invoice shows every payment received against it and the balance still due.
  const activePayments = useMemo(() => (payments.data?.items || []).filter((p) => p.status === 'active').sort((a, b) => new Date(a.date) - new Date(b.date)), [payments.data]);
  const html = useMemo(() => renderInvoice({ ...invoice, payments: activePayments }, { settings, assets }), [invoice, activePayments, settings, assets]);
  const c = invoice.currency;
  const locked = invoice.status === 'paid' || invoice.status === 'cancelled';
  const opts = { invalidate: [['invoices'], ['clients']] };

  const send = useApiMutation(() => api.post(`/invoices/${invoice._id}/send`), { ...opts, success: (r) => `Invoice ${r.data.invoice.number} finalised and marked as sent` });
  const dup = useApiMutation(() => api.post(`/invoices/${invoice._id}/duplicate`), {
    ...opts,
    success: 'Copied into a new draft',
    onSuccess: (r) => navigate(`/invoices/${r.data.invoice._id}/edit`),
  });
  const cancelDone = useApiMutation(async () => {}, { ...opts, success: 'Invoice cancelled' });

  const pdfUrl = `/api/invoices/${invoice._id}/pdf`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/invoices" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-body">
            <ArrowLeft className="size-3.5" /> Invoices
          </Link>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-black tracking-tight text-ink">
            {invoice.number ? <span className="font-mono">{invoice.number}</span> : <span>Draft invoice</span>} <InvoiceStatusBadge status={invoice.displayStatus} />
          </h1>
          <p className="mt-1 text-sm text-muted">
            <Link to={`/clients/${invoice.client}`} className="font-semibold text-body hover:text-brand-600">{invoice.snapshot.client.name}</Link> · {formatLongDate(invoice.issueDate)}
            {invoice.quoteNumber && <> · from quote <Link to={`/quotes/${invoice.quote}`} className="font-mono text-brand-600 hover:underline">{invoice.quoteNumber}</Link></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button as="a" href={`${pdfUrl}?download=1`}><Download className="size-4" /> Download PDF</Button>
          <Button as="a" href={pdfUrl} target="_blank" rel="noreferrer" variant="secondary"><ExternalLink className="size-4" /> Open PDF</Button>
          {!locked && (
            <Button as={Link} to={`/invoices/${invoice._id}/edit`} variant="secondary"><Pencil className="size-4" /> Edit</Button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <DocumentPreview html={html} debounce={0} />
          <Card>
            <CardHeader title="Payments" description="Each payment has its own numbered receipt." />
            <PaymentsTable query={payments} showClient={false} showInvoice={false} empty={<p className="px-5 py-6 text-sm text-muted">No payments recorded yet.</p>} />
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardHeader title="Summary" />
            <dl className="px-5 py-3 text-sm">
              <Row label="Total">{formatMoney(invoice.total, c)}</Row>
              {invoice.split?.type === 'advance' && (
                <>
                  <Row label="Advance due now">{formatMoney(invoice.split.advanceAmount, c)}</Row>
                  <Row label="On completion">{formatMoney(invoice.split.balanceAmount, c)}</Row>
                </>
              )}
              <Row label="Received">{formatMoney(invoice.amountPaid, c)}</Row>
              {invoice.tdsAmount > 0 && <Row label="TDS">{formatMoney(invoice.tdsAmount, c)}</Row>}
              <div className="my-1 border-t border-line/60" />
              <Row label="Balance due" strong>{invoice.status === 'cancelled' ? '—' : formatMoney(invoice.balanceDue, c)}</Row>
              {c !== 'INR' && <Row label={`In INR @ ${invoice.exchangeRate}`}>{formatMoney(invoice.totalInr)}</Row>}
            </dl>
          </Card>

          <HandoverPanel invoice={invoice} />

          <Card>
            <CardHeader title="Actions" />
            <div className="grid gap-2 p-4">
              {invoice.status === 'draft' && (
                <>
                  <Button variant="dark" onClick={() => send.mutate()} loading={send.isPending}><Send className="size-4" /> Finalise & mark sent</Button>
                  <p className="-mt-1 text-xs text-muted">Drafts have no number yet. Finalising gives it the next invoice number.</p>
                </>
              )}
              {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                <Button onClick={() => setRecording(true)}><Wallet className="size-4" /> Record payment</Button>
              )}
              {invoice.status === 'partly_paid' && (
                <p className="rounded-lg bg-lavender px-3 py-2 text-xs text-brand-700">
                  <b>{formatMoney(invoice.balanceDue, c)}</b> still due. To ask for it, download this invoice again: it now lists the payments received and the balance due, so no second invoice is needed.
                </p>
              )}
              <Button variant="secondary" onClick={() => dup.mutate()} loading={dup.isPending}><Copy className="size-4" /> Duplicate</Button>
              {isOwner && invoice.status !== 'cancelled' && invoice.amountPaid + invoice.tdsAmount === 0 && (
                <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setCancelling(true)}><Ban className="size-4" /> Cancel invoice</Button>
              )}
            </div>
            {locked && (
              <p className="flex items-center gap-2 border-t border-line/60 px-5 py-3 text-xs text-muted">
                <Lock className="size-3.5" /> {invoice.status === 'paid' ? 'Paid invoices are locked.' : `Cancelled: ${invoice.cancelReason}`}
              </p>
            )}
          </Card>
        </div>
      </div>

      <RecordPaymentModal open={recording} onClose={() => setRecording(false)} invoice={invoice} />

      <Modal open={cancelling} onClose={() => setCancelling(false)} title={`Cancel ${invoice.number ? `invoice ${invoice.number}` : 'this draft'}?`} size="sm">
        {cancelling && (
          <CancelForm
            invoice={invoice}
            onCancel={() => setCancelling(false)}
            onDone={() => {
              setCancelling(false);
              cancelDone.mutate();
            }}
          />
        )}
      </Modal>
    </>
  );
}

export function InvoiceViewPage() {
  const { id } = useParams();
  const invoice = useInvoice(id);
  const settings = useSettings();
  return <QueryState query={settings}>{(s) => <QueryState query={invoice}>{(inv) => <View invoice={inv} settings={s} />}</QueryState>}</QueryState>;
}
