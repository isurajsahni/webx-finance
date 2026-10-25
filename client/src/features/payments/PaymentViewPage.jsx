import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Ban, Download, ExternalLink, FileText, Paperclip, Upload } from 'lucide-react';
import { PAYMENT_MODE_LABELS } from '@webx/shared/constants.js';
import { formatMoney } from '@webx/shared/money.js';
import { formatLongDate } from '@webx/shared/fy.js';
import { renderReceipt } from '@webx/shared/templates/index.js';
import { api, errorMessage } from '@/api/client';
import { useApiMutation, usePayment, useSettings } from '@/api/hooks';
import { useAuth } from '@/features/auth/AuthContext';
import { DocumentPreview } from '@/components/DocumentPreview';
import { previewAssets } from '@/lib/documentAssets';
import { Badge, Button, Card, CardHeader, Field, Modal, ModalFooter, QueryState, Textarea } from '@/components/ui';

const voidSchema = z.object({ reason: z.string().trim().min(3, 'Give a reason (min 3 characters)').max(500) });

function VoidForm({ payment, onDone, onCancel }) {
  const { register, handleSubmit, formState, setError } = useForm({ resolver: zodResolver(voidSchema), defaultValues: { reason: '' } });
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        try {
          await api.post(`/payments/${payment._id}/void`, v);
          onDone();
        } catch (err) {
          setError('reason', { message: errorMessage(err) });
        }
      })}
      noValidate
    >
      <p className="mb-4 text-sm text-muted">
        Use this for a bounced cheque or a payment recorded by mistake. The receipt stays on file marked <b>Void</b> and invoice {payment.invoiceNumber} goes back to its balance before this payment.
      </p>
      <Field label="Reason" required error={formState.errors.reason?.message}>
        <Textarea rows={3} {...register('reason')} autoFocus />
      </Field>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>Keep payment</Button>
        <Button variant="danger" type="submit" loading={formState.isSubmitting}>Void payment</Button>
      </ModalFooter>
    </form>
  );
}

function View({ payment, settings }) {
  const { isOwner } = useAuth();
  const [voiding, setVoiding] = useState(false);
  const fileRef = useRef(null);
  const assets = useMemo(() => previewAssets(settings), [settings]);
  const html = useMemo(() => renderReceipt(payment, { settings, assets }), [payment, settings, assets]);
  const c = payment.currency;
  const opts = { invalidate: [['payments'], ['invoices'], ['clients']] };
  const voidDone = useApiMutation(async () => {}, { ...opts, success: 'Payment voided' });
  const proof = useApiMutation(
    (file) => {
      const fd = new FormData();
      fd.append('proof', file);
      return api.post(`/payments/${payment._id}/proof`, fd);
    },
    { ...opts, success: 'Proof attached' },
  );
  const receiptUrl = `/api/payments/${payment._id}/receipt`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/payments" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-body">
            <ArrowLeft className="size-3.5" /> Payments
          </Link>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-black tracking-tight text-ink">
            <span className="font-mono">{payment.receiptNumber}</span>
            {payment.status === 'void' ? <Badge tone="red">Void</Badge> : <Badge tone="green">Received</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted">
            <Link to={`/clients/${payment.client}`} className="font-semibold text-body hover:text-brand-600">{payment.snapshot.client.name}</Link> · {formatLongDate(payment.date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button as="a" href={`${receiptUrl}?download=1`}><Download className="size-4" /> Download receipt</Button>
          <Button as="a" href={receiptUrl} target="_blank" rel="noreferrer" variant="secondary"><ExternalLink className="size-4" /> Open PDF</Button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <DocumentPreview html={html} debounce={0} />
        <div className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardHeader title="Payment" />
            <dl className="space-y-2 px-5 py-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Amount</dt><dd className="font-bold tabular-nums">{formatMoney(payment.amount, c)}</dd></div>
              {payment.tds > 0 && <div className="flex justify-between"><dt className="text-muted">TDS</dt><dd className="tabular-nums">{formatMoney(payment.tds, c)}</dd></div>}
              {c !== 'INR' && <div className="flex justify-between"><dt className="text-muted">In INR</dt><dd className="tabular-nums">{formatMoney(payment.amountInr)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">Mode</dt><dd>{PAYMENT_MODE_LABELS[payment.mode]}</dd></div>
              {payment.reference && <div className="flex justify-between gap-3"><dt className="text-muted">Reference</dt><dd className="truncate font-mono text-xs">{payment.reference}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">Into</dt><dd>{payment.bankAccount?.label || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Invoice</dt><dd><Link to={`/invoices/${payment.invoice}`} className="font-mono text-xs font-semibold text-brand-600 hover:underline">{payment.invoiceNumber}</Link></dd></div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Proof" />
            <div className="space-y-3 px-5 py-4 text-sm">
              {payment.proof ? (
                <a href={`/api/files/${payment.proof.key}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold text-brand-600 hover:underline">
                  {payment.proof.mimeType === 'application/pdf' ? <FileText className="size-4" /> : <Paperclip className="size-4" />}
                  <span className="truncate">{payment.proof.originalName || 'View proof'}</span>
                </a>
              ) : (
                <p className="text-muted">No proof attached.</p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) proof.mutate(f);
                  e.target.value = '';
                }}
              />
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} loading={proof.isPending}>
                <Upload className="size-3.5" /> {payment.proof ? 'Replace' : 'Attach'}
              </Button>
            </div>
          </Card>

          {payment.status === 'void' ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">Voided: {payment.voidReason}</p>
          ) : (
            isOwner && (
              <Button variant="ghost" className="w-full text-red-600 hover:bg-red-50" onClick={() => setVoiding(true)}>
                <Ban className="size-4" /> Void payment
              </Button>
            )
          )}
        </div>
      </div>

      <Modal open={voiding} onClose={() => setVoiding(false)} title={`Void ${payment.receiptNumber}?`} size="sm">
        {voiding && <VoidForm payment={payment} onCancel={() => setVoiding(false)} onDone={() => { setVoiding(false); voidDone.mutate(); }} />}
      </Modal>
    </>
  );
}

export function PaymentViewPage() {
  const { id } = useParams();
  const payment = usePayment(id);
  const settings = useSettings();
  return <QueryState query={settings}>{(s) => <QueryState query={payment}>{(p) => <View payment={p} settings={s} />}</QueryState>}</QueryState>;
}
