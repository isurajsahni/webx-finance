import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Paperclip, X } from 'lucide-react';
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from '@webx/shared/constants.js';
import { currencySymbol, formatMoney, fromMinor, toMinor } from '@webx/shared/money.js';
import { todayISO } from '@webx/shared/fy.js';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { useBankAccounts, useInvoices } from '@/api/hooks';
import { Button, Field, Input, ModalFooter, MoneyInput, Select, Switch, Textarea } from '@/components/ui';

const MAX_MB = 10;
const schema = z
  .object({
    invoice: z.string().min(1, 'Choose an invoice'),
    date: z.string().min(1, 'Pick a date'),
    amount: z.string(),
    tdsOn: z.boolean(),
    tds: z.string(),
    mode: z.enum(PAYMENT_MODES),
    reference: z.string().trim().max(80),
    bankAccount: z.string(),
    exchangeRate: z.string(),
    notes: z.string().trim().max(1000),
  })
  .superRefine((v, ctx) => {
    const amt = toMinor(v.amount);
    if (v.amount.trim() && (amt === null || amt < 0)) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter a valid amount' });
    if (v.tdsOn && (toMinor(v.tds) === null || toMinor(v.tds) < 0)) ctx.addIssue({ code: 'custom', path: ['tds'], message: 'Enter the TDS amount' });
    if ((amt || 0) + (v.tdsOn ? toMinor(v.tds) || 0 : 0) <= 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter the amount received' });
  });

/** Advance not yet received → suggest the advance; otherwise the full balance. */
export function suggestedAmount(inv) {
  if (!inv) return 0;
  const settled = inv.amountPaid + inv.tdsAmount;
  if (inv.split?.type === 'advance' && settled === 0) return inv.split.advanceAmount;
  return inv.balanceDue;
}

export function RecordPaymentForm({ invoice: fixedInvoice, onDone, onCancel }) {
  const accounts = useBankAccounts();
  const open = useInvoices({ status: 'open', limit: 100, sort: '-issueDate' }, { enabled: !fixedInvoice });
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);

  const { register, handleSubmit, control, setValue, formState, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      invoice: fixedInvoice?._id || '',
      date: todayISO(),
      amount: fixedInvoice ? fromMinor(suggestedAmount(fixedInvoice)) : '',
      tdsOn: false,
      tds: '',
      mode: 'upi',
      reference: '',
      bankAccount: '',
      exchangeRate: String(fixedInvoice?.exchangeRate ?? 1),
      notes: '',
    },
  });
  const v = useWatch({ control });
  const e = formState.errors;

  const invoice = fixedInvoice || open.data?.items.find((i) => i._id === v.invoice);
  const c = invoice?.currency || 'INR';
  const sym = currencySymbol(c).trim();
  const amount = toMinor(v.amount) || 0;
  const tds = v.tdsOn ? toMinor(v.tds) || 0 : 0;
  const after = invoice ? invoice.balanceDue - amount - tds : 0;

  // Pick a sensible "received into" account for the mode and invoice.
  const bankList = accounts.data || [];
  const defaultAccount = useMemo(() => {
    if (v.mode === 'cash') return bankList.find((a) => a.kind === 'cash')?._id;
    const invBank = invoice?.bankAccount?._id || invoice?.bankAccount;
    return (invBank && bankList.some((a) => a._id === invBank) && invBank) || bankList.find((a) => a.isDefault)?._id || bankList.find((a) => a.kind === 'bank')?._id;
  }, [v.mode, invoice, bankList]);
  useEffect(() => {
    if (defaultAccount) setValue('bankAccount', defaultAccount);
  }, [defaultAccount, setValue]);

  // When an invoice is picked from the list, prefill amount and rate.
  useEffect(() => {
    if (fixedInvoice || !invoice) return;
    setValue('amount', fromMinor(suggestedAmount(invoice)));
    setValue('exchangeRate', String(invoice.exchangeRate ?? 1));
  }, [invoice?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (vals) => {
    if (after < 0) {
      setError('amount', { message: `More than the balance due (${formatMoney(invoice.balanceDue, c)})` });
      return;
    }
    const body = {
      invoice: vals.invoice,
      date: vals.date,
      amount: toMinor(vals.amount) || 0,
      tds: vals.tdsOn ? toMinor(vals.tds) || 0 : 0,
      mode: vals.mode,
      reference: vals.reference,
      bankAccount: vals.bankAccount || null,
      notes: vals.notes,
      ...(c !== 'INR' ? { exchangeRate: Number(vals.exchangeRate) || undefined } : {}),
    };
    try {
      let res;
      if (file) {
        const fd = new FormData();
        fd.append('data', JSON.stringify(body));
        fd.append('proof', file);
        res = await api.post('/payments', fd);
      } else {
        res = await api.post('/payments', body);
      }
      onDone(res.data.payment, res.data.invoice);
    } catch (err) {
      if (!applyServerErrors(err, setError)) setError('root', { message: errorMessage(err) });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {e.root && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{e.root.message}</p>}

      {!fixedInvoice && (
        <Field label="Invoice" required error={e.invoice?.message}>
          <Select {...register('invoice')}>
            <option value="">{open.isPending ? 'Loading…' : open.data?.items.length ? 'Choose an unpaid invoice' : 'No unpaid invoices'}</option>
            {open.data?.items.map((i) => (
              <option key={i._id} value={i._id}>
                {i.number || 'Draft'} · {i.snapshot.client.name} · due {formatMoney(i.balanceDue, i.currency)}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {invoice && (
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-panel px-4 py-3 text-sm">
          <div><p className="text-xs text-muted">Invoice total</p><p className="font-bold tabular-nums">{formatMoney(invoice.total, c)}</p></div>
          <div><p className="text-xs text-muted">Balance due</p><p className="font-bold tabular-nums">{formatMoney(invoice.balanceDue, c)}</p></div>
          <div><p className="text-xs text-muted">After this</p><p className={`font-bold tabular-nums ${after < 0 ? 'text-red-600' : after === 0 ? 'text-emerald-600' : 'text-brand-600'}`}>{formatMoney(Math.max(after, 0), c)}{after === 0 && ' ✓'}</p></div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount received" required error={e.amount?.message}>
          <MoneyInput symbol={sym} {...register('amount')} autoFocus />
        </Field>
        <Field label="Payment date" required error={e.date?.message}>
          <Input type="date" {...register('date')} />
        </Field>
      </div>
      {invoice && (
        <div className="-mt-2 flex flex-wrap gap-2">
          {invoice.split?.type === 'advance' && invoice.amountPaid + invoice.tdsAmount === 0 && (
            <Button size="sm" variant="ghost" onClick={() => setValue('amount', fromMinor(invoice.split.advanceAmount))}>Advance {formatMoney(invoice.split.advanceAmount, c)}</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setValue('amount', fromMinor(invoice.balanceDue - tds))}>Full balance {formatMoney(invoice.balanceDue - tds, c)}</Button>
        </div>
      )}

      <div className="rounded-xl border border-line/80 p-3">
        <Switch checked={v.tdsOn} onChange={(on) => setValue('tdsOn', on)} label="Client deducted TDS" description="TDS counts towards settling the invoice." />
        {v.tdsOn && (
          <Field label="TDS amount" error={e.tds?.message} className="mt-3 sm:w-1/2">
            <MoneyInput symbol={sym} {...register('tds')} />
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mode">
          <Select {...register('mode')}>
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>)}
          </Select>
        </Field>
        <Field label="Reference / UTR no." error={e.reference?.message}>
          <Input {...register('reference')} placeholder={v.mode === 'cheque' ? 'Cheque no.' : 'e.g. UTR / transaction ID'} />
        </Field>
        <Field label="Received into" error={e.bankAccount?.message}>
          <Select {...register('bankAccount')}>
            {bankList.map((a) => <option key={a._id} value={a._id}>{a.label}</option>)}
          </Select>
        </Field>
        {c !== 'INR' && (
          <Field label={`1 ${c} = ₹`} hint="Rate actually received; used for INR reports.">
            <Input inputMode="decimal" {...register('exchangeRate')} />
          </Field>
        )}
      </div>

      <Field label="Proof of payment" hint={`Screenshot or PDF, up to ${MAX_MB} MB (optional).`}>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(ev) => {
              const f = ev.target.files?.[0] || null;
              if (f && f.size > MAX_MB * 1024 * 1024) {
                setError('root', { message: `File is too large (max ${MAX_MB} MB)` });
                ev.target.value = '';
                return setFile(null);
              }
              setFile(f);
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><Paperclip className="size-3.5" /> {file ? 'Change file' : 'Attach file'}</Button>
          {file && (
            <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
              <span className="truncate">{file.name}</span>
              <button type="button" aria-label="Remove file" className="rounded p-0.5 hover:bg-panel" onClick={() => { fileRef.current.value = ''; setFile(null); }}><X className="size-3.5" /></button>
            </span>
          )}
        </div>
      </Field>

      <Field label="Note on receipt" error={e.notes?.message} hint="Optional. Printed on the receipt.">
        <Textarea rows={2} {...register('notes')} />
      </Field>

      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={formState.isSubmitting}>Record payment</Button>
      </ModalFooter>
    </form>
  );
}
