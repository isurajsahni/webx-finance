import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Ban, Check, CheckCircle2, Circle, Download, ExternalLink, Pencil, Wallet, X } from 'lucide-react';
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from '@webx/shared/constants.js';
import { formatMoney } from '@webx/shared/money.js';
import { formatLongDate, formatShortDate, todayISO } from '@webx/shared/fy.js';
import { renderExpenseVoucher } from '@webx/shared/templates/index.js';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { useApiMutation, useBankAccounts, useReimbursement, useSettings } from '@/api/hooks';
import { useAuth } from '@/features/auth/AuthContext';
import { DocumentPreview } from '@/components/DocumentPreview';
import { FilesField } from '@/components/FilesField';
import { previewAssets } from '@/lib/documentAssets';
import { Button, Card, CardHeader, Field, Input, Modal, ModalFooter, QueryState, Select } from '@/components/ui';
import { ExpenseForm } from './ExpenseForm';
import { ReasonForm } from './ReasonForm';
import { ReimbursementBadge } from './ReimbursementStatus';

const reimburseSchema = z.object({
  date: z.string().min(1, 'Pick a date'),
  paidFrom: z.string().min(1, 'Choose the account'),
  mode: z.enum(PAYMENT_MODES),
  reference: z.string().trim().max(80),
});

function ReimburseForm({ claim, onDone, onCancel }) {
  const accounts = useBankAccounts();
  const def = accounts.data?.find((a) => a.isDefault)?._id || '';
  const { register, handleSubmit, formState, setError, setValue, getValues } = useForm({ resolver: zodResolver(reimburseSchema), defaultValues: { date: todayISO(), paidFrom: def, mode: 'upi', reference: '' } });
  const e = formState.errors;
  useEffect(() => {
    if (def && !getValues('paidFrom')) setValue('paidFrom', def);
  }, [def, getValues, setValue]);
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        try {
          await api.post(`/reimbursements/${claim._id}/reimburse`, v);
          onDone();
        } catch (err) {
          if (!applyServerErrors(err, setError)) setError('reference', { message: errorMessage(err) });
        }
      })}
      className="space-y-4"
      noValidate
    >
      <p className="rounded-xl bg-panel px-4 py-3 text-sm">Paying <b>{claim.reimbursement.payeeName}</b> <b className="text-brand-600">{formatMoney(claim.amount)}</b>. A numbered reimbursement voucher is created.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date paid" error={e.date?.message}><Input type="date" {...register('date')} /></Field>
        <Field label="Paid from" error={e.paidFrom?.message}>
          <Select {...register('paidFrom')}>
            <option value="">Choose account</option>
            {accounts.data?.map((a) => <option key={a._id} value={a._id}>{a.label}</option>)}
          </Select>
        </Field>
        <Field label="Mode"><Select {...register('mode')}>{PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>)}</Select></Field>
        <Field label="Reference" error={e.reference?.message}><Input {...register('reference')} /></Field>
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={formState.isSubmitting}><Wallet className="size-4" /> Mark reimbursed</Button>
      </ModalFooter>
    </form>
  );
}

function Step({ done, active, label, sub }) {
  return (
    <li className="flex gap-3">
      {done ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" /> : <Circle className={`size-5 shrink-0 ${active ? 'text-brand-500' : 'text-line'}`} />}
      <div><p className={`text-sm font-semibold ${done || active ? 'text-ink' : 'text-muted'}`}>{label}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</div>
    </li>
  );
}

function View({ claim, settings }) {
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const [modal, setModal] = useState(null); // edit | reject | reimburse | void
  const assets = useMemo(() => previewAssets(settings), [settings]);
  const html = useMemo(() => renderExpenseVoucher(claim, { settings, assets }), [claim, settings, assets]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['reimbursements'] });
  const approve = useApiMutation(() => api.post(`/reimbursements/${claim._id}/approve`), { invalidate: [['reimbursements']], success: 'Claim approved' });
  const r = claim.reimbursement;
  const s = claim.status === 'void' ? 'void' : r.status;
  const url = `/api/reimbursements/${claim._id}/voucher`;
  const close = () => setModal(null);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/reimbursements" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-body"><ArrowLeft className="size-3.5" /> Reimbursements</Link>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-black tracking-tight text-ink">
            {r.payeeName} · {formatMoney(claim.amount)} <ReimbursementBadge doc={claim} />
          </h1>
          <p className="mt-1 text-sm text-muted">{claim.categoryName}{claim.vendor && ` · ${claim.vendor}`} · spent {formatLongDate(claim.date)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {s === 'reimbursed' && (
            <>
              <Button as="a" href={`${url}?download=1`}><Download className="size-4" /> Download voucher</Button>
              <Button as="a" href={url} target="_blank" rel="noreferrer" variant="secondary"><ExternalLink className="size-4" /> Open PDF</Button>
            </>
          )}
          {s === 'submitted' && <Button variant="secondary" onClick={() => setModal('edit')}><Pencil className="size-4" /> Edit</Button>}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {s !== 'reimbursed' && <p className="mb-2 text-xs text-muted">Voucher preview. The voucher number is assigned when the claim is reimbursed.</p>}
          <DocumentPreview html={html} debounce={0} />
        </div>
        <div className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardHeader title="Progress" />
            <ol className="space-y-3 px-5 py-4">
              <Step done label="Submitted" sub={formatShortDate(claim.createdAt)} />
              {s === 'rejected' ? (
                <Step active label="Rejected" sub={r.rejectedReason} />
              ) : (
                <>
                  <Step done={!!r.approvedAt} active={s === 'submitted'} label="Approved" sub={r.approvedAt && formatShortDate(r.approvedAt)} />
                  <Step done={s === 'reimbursed'} active={s === 'approved'} label="Reimbursed" sub={r.reimbursedAt && `${formatShortDate(r.reimbursedAt)} · ${PAYMENT_MODE_LABELS[r.mode]} · ${claim.voucherNumber}`} />
                </>
              )}
            </ol>
            {claim.status !== 'void' && (s === 'submitted' || s === 'approved') && (
              <div className="grid gap-2 border-t border-line/60 p-4">
                {s === 'submitted' && isOwner && <Button onClick={() => approve.mutate()} loading={approve.isPending}><Check className="size-4" /> Approve</Button>}
                {s === 'submitted' && !isOwner && <p className="text-xs text-muted">Waiting for the owner to approve.</p>}
                {s === 'approved' && <Button onClick={() => setModal('reimburse')}><Wallet className="size-4" /> Mark reimbursed</Button>}
                {isOwner && <Button variant="ghost" onClick={() => setModal('reject')}><X className="size-4" /> Reject</Button>}
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Bills" />
            <div className="px-5 py-4 text-sm">{claim.bills?.length ? <FilesField existing={claim.bills} files={[]} onFiles={() => {}} max={0} /> : <p className="text-muted">No bills attached.</p>}</div>
          </Card>
          {claim.status === 'void' ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">Voided: {claim.voidReason}</p>
          ) : (
            isOwner && <Button variant="ghost" className="w-full text-red-600 hover:bg-red-50" onClick={() => setModal('void')}><Ban className="size-4" /> Void claim</Button>
          )}
        </div>
      </div>

      <Modal open={modal === 'edit'} onClose={close} title="Edit claim" size="lg">
        {modal === 'edit' && <ExpenseForm kind="reimbursement" doc={claim} onCancel={close} onDone={() => { close(); refresh(); toast.success('Claim saved'); }} />}
      </Modal>
      <Modal open={modal === 'reimburse'} onClose={close} title="Mark as reimbursed" size="md">
        {modal === 'reimburse' && <ReimburseForm claim={claim} onCancel={close} onDone={() => { close(); refresh(); toast.success('Reimbursed · voucher created'); }} />}
      </Modal>
      <Modal open={modal === 'reject'} onClose={close} title="Reject claim?" size="sm">
        {modal === 'reject' && <ReasonForm url={`/reimbursements/${claim._id}/reject`} confirmLabel="Reject claim" onCancel={close} onDone={() => { close(); refresh(); toast.success('Claim rejected'); }} />}
      </Modal>
      <Modal open={modal === 'void'} onClose={close} title="Void claim?" size="sm">
        {modal === 'void' && (
          <ReasonForm url={`/reimbursements/${claim._id}/void`} intro="The claim stays on file marked Void and is excluded from totals." confirmLabel="Void claim" onCancel={close} onDone={() => { close(); refresh(); toast.success('Claim voided'); }} />
        )}
      </Modal>
    </>
  );
}

export function ReimbursementViewPage() {
  const { id } = useParams();
  const claim = useReimbursement(id);
  const settings = useSettings();
  return <QueryState query={settings}>{(s) => <QueryState query={claim}>{(c) => <View claim={c} settings={s} />}</QueryState>}</QueryState>;
}
