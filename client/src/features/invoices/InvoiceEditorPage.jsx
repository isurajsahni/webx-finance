import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowLeft, ArrowUp, Eye, PencilLine, Plus, RotateCcw, Trash2, UserPlus, Users } from 'lucide-react';
import { CURRENCIES, PAYMENT_MODES, PAYMENT_MODE_LABELS } from '@webx/shared/constants.js';
import { isIndia, stateCodeFor } from '@webx/shared/india.js';
import { formatMoney, currencySymbol, toMinor, fromMinor } from '@webx/shared/money.js';
import { HOSTING_PERIODS, MAINTENANCE_PERIODS, handoverSummary } from '@webx/shared/handover.js';
import { formatLongDate } from '@webx/shared/fy.js';
import { lineAmount } from '@webx/shared/invoiceMath.js';
import { renderInvoice } from '@webx/shared/templates/index.js';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { useBankAccounts, useClients, useInvoice, useNextDocNumber, useQuote, useServices, useSettings } from '@/api/hooks';
import { DocumentPreview } from '@/components/DocumentPreview';
import { Button, Card, CardHeader, Field, Input, MoneyInput, QueryState, Select, Switch, Textarea } from '@/components/ui';
import { previewAssets } from '@/lib/documentAssets';
import { cn } from '@/lib/cn';
import { ClientFields, emptyClient } from '@/features/clients/ClientForm';
import { defaultValues, emptyItem, emptyPaidRow, fromInvoice, invoiceFormSchema, paidPayments, paidSwitchValues, previewModel, toPayload } from './invoiceForm';

const FIELD_LABELS = { client: 'Client', newClient: 'New client', number: 'Invoice number', issueDate: 'Invoice date', dueDate: 'Due date', exchangeRate: 'Exchange rate', items: 'Line items', discountValue: 'Discount', advanceValue: 'Advance', note: 'Note', hoStartDate: 'Free periods start', paidRows: 'Payment', paidTds: 'TDS', paid: 'Payments' };

/** First validation error as { label, message }, for a toast that says what to fix. */
function firstError(errors, path = []) {
  for (const [key, val] of Object.entries(errors || {})) {
    if (!val) continue;
    if (typeof val.message === 'string' && val.message) {
      const p = [...path, key];
      const itemIdx = p[0] === 'items' && /^\d+$/.test(p[1]) ? ` ${Number(p[1]) + 1}` : '';
      return { label: `${FIELD_LABELS[p[0]] || p[0]}${itemIdx}`, message: val.message };
    }
    if (typeof val === 'object') {
      const nested = firstError(val, [...path, key]);
      if (nested) return nested;
    }
  }
  return null;
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-panel p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('rounded-md px-3 py-1.5 text-xs font-bold transition-colors', value === o.value ? 'bg-white text-ink shadow-xs' : 'text-muted hover:text-body')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ServicePicker({ onPick }) {
  const services = useServices({ limit: 200, active: '1' });
  const list = services.data?.items || [];
  if (!list.length) {
    return <Link to="/services" className="text-xs font-semibold text-brand-600 hover:underline">Save your services to pick them here</Link>;
  }
  return (
    <Select
      value=""
      onChange={(e) => {
        const svc = list.find((x) => x._id === e.target.value);
        if (svc) onPick(svc);
      }}
      className="h-8 w-60 py-1 text-xs"
      aria-label="Add a saved service"
    >
      <option value="">+ Add a saved service…</option>
      {list.map((x) => (
        <option key={x._id} value={x._id}>{x.name} · {formatMoney(x.rate)}{x.unit ? ` / ${x.unit}` : ''}</option>
      ))}
    </Select>
  );
}

function ItemsEditor({ control, register, errors, currency, gst }) {
  const { fields, append, remove, move, update } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' });
  const sym = currencySymbol(currency).trim();

  return (
    <Card>
      <CardHeader title="Line items" description="Qty and Rate columns appear on the PDF only when a quantity is more than 1." />
      <div className="divide-y divide-line/60">
        {fields.map((f, i) => {
          const e = errors.items?.[i] || {};
          const it = items?.[i] || {};
          const amount = lineAmount(Number(String(it.qty).replace(/,/g, '')) || 0, toMinor(it.rate) ?? 0);
          return (
            <div key={f.id} className="grid gap-3 px-5 py-4">
              <div className="flex items-start gap-2">
                <span className="mt-2.5 w-5 shrink-0 text-xs font-bold text-muted">{i + 1}.</span>
                <div className="grid flex-1 gap-3">
                  <Field error={e.title?.message}>
                    <Input {...register(`items.${i}.title`)} placeholder="Website Design & Development" aria-label={`Item ${i + 1} title`} className="font-semibold" />
                  </Field>
                  <Textarea rows={2} {...register(`items.${i}.description`)} placeholder="Description (optional)" aria-label={`Item ${i + 1} description`} />
                  <div className={cn('grid gap-3', gst ? 'grid-cols-2 sm:grid-cols-[1fr_80px_1.3fr_1.2fr]' : 'grid-cols-[80px_1fr] sm:grid-cols-[80px_1.3fr_1.2fr]')}>
                    {gst && (
                      <Field label="SAC/HSN" error={e.sac?.message}>
                        <Input {...register(`items.${i}.sac`)} placeholder="998314" />
                      </Field>
                    )}
                    <Field label="Qty" error={e.qty?.message}>
                      <Input inputMode="decimal" {...register(`items.${i}.qty`)} className="tabular-nums" />
                    </Field>
                    <Field label={`Rate (${sym})`} error={e.rate?.message}>
                      <MoneyInput symbol={sym} {...register(`items.${i}.rate`)} placeholder="0" />
                    </Field>
                    <div className="col-span-full space-y-1.5 sm:col-span-1">
                      <p className="text-[13px] font-semibold">Amount</p>
                      <p className="flex h-9.5 items-center justify-end rounded-lg bg-panel px-3 text-sm font-bold text-ink tabular-nums">{formatMoney(amount, currency)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up"><ArrowUp className="size-4" /></Button>
                  <Button variant="ghost" size="icon" disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down"><ArrowDown className="size-4" /></Button>
                  <Button variant="ghost" size="icon" disabled={fields.length === 1} onClick={() => remove(i)} aria-label={`Remove item ${i + 1}`}><Trash2 className="size-4 text-muted" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {errors.items?.root?.message && <p className="px-5 text-xs font-medium text-red-600">{errors.items.root.message}</p>}
      <div className="border-t border-line/60 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => append(emptyItem())} disabled={fields.length >= 200}>
            <Plus className="size-4" /> Add line item
          </Button>
          <ServicePicker
            onPick={(svc) => {
              const line = { title: svc.name, description: svc.description || '', sac: svc.sac || '', qty: '1', rate: fromMinor(svc.rate) };
              // Fill the first line if it is still empty, otherwise add a new one.
              const firstEmpty = fields.length === 1 && !items?.[0]?.title && !items?.[0]?.rate;
              if (firstEmpty) update(0, line);
              else append(line);
            }}
          />
        </div>
      </div>
    </Card>
  );
}

function HandoverCard({ register, v, setValue, errors }) {
  const fromDate = v.hoStartsOn === 'date';
  const { start, hostingEnd, maintenanceEnd } = handoverSummary({
    handoverDate: v.handoverDate ? `${v.handoverDate}T00:00:00Z` : null,
    startDate: fromDate && v.hoStartDate ? `${v.hoStartDate}T00:00:00Z` : null,
    hostingMonths: Number(v.hostingMonths),
    maintenanceMonths: Number(v.maintenanceMonths),
  });
  return (
    <Card>
      <CardHeader
        title="Website handover, hosting & maintenance"
        description="Prints the free hosting / maintenance periods, counted from the handover date, and what maintenance does and does not cover."
        actions={<Switch checked={v.hoEnabled} onChange={(on) => setValue('hoEnabled', on)} label={v.hoEnabled ? 'On' : 'Off'} />}
      />
      {v.hoEnabled && (
        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Free hosting">
              <Select {...register('hostingMonths')}>
                {HOSTING_PERIODS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Free maintenance">
              <Select {...register('maintenanceMonths')}>
                {MAINTENANCE_PERIODS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Handover date" hint="Leave blank until you hand it over.">
              <Input type="date" {...register('handoverDate')} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Free periods start" className="sm:col-span-2">
              <Segmented
                value={v.hoStartsOn}
                onChange={(m) => setValue('hoStartsOn', m)}
                options={[
                  { value: 'handover', label: 'On the handover date' },
                  { value: 'date', label: 'From a date I choose' },
                ]}
              />
            </Field>
            {fromDate && (
              <Field label="Start date" error={errors.hoStartDate?.message} hint="Past or future.">
                <Input type="date" {...register('hoStartDate')} />
              </Field>
            )}
          </div>
          <p className="rounded-lg bg-panel px-3 py-2 text-xs text-muted">
            {start
              ? [`Starts ${formatLongDate(start)}`, hostingEnd && `hosting valid until ${formatLongDate(hostingEnd)}`, maintenanceEnd && `maintenance until ${formatLongDate(maintenanceEnd)}`].filter(Boolean).join(' · ')
              : fromDate
                ? 'Pick the date the free periods start.'
                : 'Both periods start on the day the website is handed over. Add the date later from the invoice page, even after it is paid.'}
          </p>
          <p className="text-xs text-muted">
            The <b>included</b> and <b>not included</b> lists come from <Link to="/settings/preferences" className="text-brand-600 hover:underline">Settings → GST & defaults</Link>.
          </p>
        </div>
      )}
    </Card>
  );
}

/** Bill for money already received: each payment with its amount and date. Saving issues a receipt for each. */
function AlreadyPaidCard({ control, register, v, setValue, errors, banks, total }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'paidRows' });
  const sym = currencySymbol(v.currency).trim();
  const set = (values) => Object.entries(values).forEach(([k, val]) => setValue(k, val));
  const rows = v.paidRows || [];
  const tds = v.paidTdsOn ? toMinor(v.paidTds) || 0 : 0;
  const received = rows.reduce((sum, r) => sum + (toMinor(r.amount) || 0), 0) + tds;
  const balance = total - received;
  // Fill a row with whatever the other payments (and TDS) leave of the total.
  const restFor = (i) => Math.max(0, total - tds - rows.reduce((sum, r, j) => sum + (j === i ? 0 : toMinor(r.amount) || 0), 0));
  return (
    <Card>
      <CardHeader
        title="Already paid?"
        description="For money the client has already paid. Add each payment with its amount and date. Saving numbers the invoice and issues a receipt for each payment; anything left shows as balance due."
        actions={<Switch checked={v.paidOn} onChange={(on) => set(paidSwitchValues(on, v))} label={v.paidOn ? 'Paid' : 'No'} />}
      />
      {v.paidOn && (
        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-panel px-4 py-3 text-sm">
            <div><p className="text-xs text-muted">Invoice total</p><p className="font-bold tabular-nums">{formatMoney(total, v.currency)}</p></div>
            <div><p className="text-xs text-muted">Already received</p><p className="font-bold tabular-nums">{formatMoney(received, v.currency)}</p></div>
            <div>
              <p className="text-xs text-muted">Balance due</p>
              <p className={cn('font-bold tabular-nums', balance < 0 ? 'text-red-600' : balance === 0 ? 'text-emerald-600' : 'text-brand-600')}>
                {balance < 0 ? `${formatMoney(-balance, v.currency)} too much` : `${formatMoney(balance, v.currency)}${balance === 0 ? ' ✓' : ''}`}
              </p>
            </div>
          </div>

          {fields.map((f, i) => {
            const e = errors.paidRows?.[i] || {};
            return (
              <div key={f.id} className="rounded-xl border border-line/80 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold">Payment {i + 1}</p>
                  <Button variant="ghost" size="icon" disabled={fields.length === 1} onClick={() => remove(i)} aria-label={`Remove payment ${i + 1}`}><Trash2 className="size-4 text-muted" /></Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Amount received" required error={e.amount?.message}>
                    <MoneyInput symbol={sym} {...register(`paidRows.${i}.amount`)} placeholder="0" />
                  </Field>
                  <Field label="Paid on" required error={e.date?.message}>
                    <Input type="date" {...register(`paidRows.${i}.date`)} />
                  </Field>
                </div>
                {total > 0 && (
                  <Button size="sm" variant="ghost" className="mt-1" onClick={() => setValue(`paidRows.${i}.amount`, fromMinor(restFor(i)))}>
                    Rest of total {formatMoney(restFor(i), v.currency)}
                  </Button>
                )}
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <Field label="Mode">
                    <Select
                      {...register(`paidRows.${i}.mode`, {
                        onChange: (ev) => {
                          const cash = banks.find((b) => b.kind === 'cash');
                          if (ev.target.value === 'cash' && cash) setValue(`paidRows.${i}.account`, cash._id);
                        },
                      })}
                    >
                      {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>)}
                    </Select>
                  </Field>
                  <Field label="Reference / UTR no." error={e.reference?.message}>
                    <Input {...register(`paidRows.${i}.reference`)} placeholder={rows[i]?.mode === 'cheque' ? 'Cheque no.' : 'UTR / transaction ID'} />
                  </Field>
                  <Field label="Received into">
                    <Select {...register(`paidRows.${i}.account`)}>
                      <option value="">Default account</option>
                      {banks.map((b) => <option key={b._id} value={b._id}>{b.label}</option>)}
                    </Select>
                  </Field>
                </div>
              </div>
            );
          })}
          {(errors.paidRows?.message || errors.paidRows?.root?.message || errors.paid?.message) && (
            <p className="text-xs font-medium text-red-600">{errors.paidRows?.message || errors.paidRows?.root?.message || errors.paid?.message}</p>
          )}
          <Button variant="secondary" size="sm" disabled={fields.length >= 20} onClick={() => append(emptyPaidRow(v.issueDate, rows[rows.length - 1]?.account || ''))}>
            <Plus className="size-4" /> Add another payment
          </Button>

          <div className="rounded-xl border border-line/80 p-3">
            <Switch checked={v.paidTdsOn} onChange={(on) => setValue('paidTdsOn', on)} label="Client deducted TDS" description="Counts towards settling the invoice. Added to the latest payment." />
            {v.paidTdsOn && (
              <Field label="TDS amount" error={errors.paidTds?.message} className="mt-3 sm:w-1/2">
                <MoneyInput symbol={sym} {...register('paidTds')} />
              </Field>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

const DOCS = {
  invoice: { base: 'invoices', Title: 'Invoice', lower: 'invoice', locked: ['paid', 'cancelled'] },
  quote: { base: 'quotes', Title: 'Quote', lower: 'quote', locked: ['accepted', 'declined', 'converted'] },
};

function Editor({ settings, invoice, banks, docType = 'invoice' }) {
  const D = DOCS[docType];
  const isQuote = docType === 'quote';
  const isEdit = !!invoice;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [showPreview, setShowPreview] = useState(false);
  const clients = useClients({ limit: 200, archived: '0' });
  const defaultBank = banks.find((b) => b.isDefault)?._id || banks.find((b) => b.kind === 'bank')?._id || '';

  const form = useForm({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: invoice
      ? fromInvoice(invoice, settings)
      : defaultValues(settings, { clientId: params.get('client') || '', bankId: defaultBank, docType, paid: !isQuote && params.get('paid') === '1' }),
  });
  const { register, control, handleSubmit, setValue, formState, setError } = form;
  const v = useWatch({ control });
  const e = formState.errors;

  // Numbered invoices keep their number; drafts get one when finalised (or a typed one).
  const hasNumber = isEdit && !!invoice.number;
  const next = useNextDocNumber(D.base, v.issueDate, !hasNumber && v.numberMode === 'auto');
  const number = hasNumber ? invoice.number : v.numberMode === 'manual' ? v.number : next.data?.number;

  const clientList = clients.data?.items || [];
  // Keep the client being edited selectable even if it is archived.
  const selectedClient = v.clientMode === 'new' ? { ...emptyClient, ...v.newClient, stateCode: isIndia(v.newClient?.country) ? stateCodeFor(v.newClient?.state) : '' } : clientList.find((c) => c._id === v.client) || (isEdit && invoice.client === v.client ? invoice.snapshot.client : null);
  const bank = banks.find((b) => b._id === v.bankAccount);

  const { invoice: model, autoNote } = useMemo(
    () => previewModel(v, { settings, client: selectedClient, bank, number, docType, existing: invoice }),
    [v, settings, selectedClient, bank, number, docType, invoice],
  );

  // The note follows the payment split until the person edits it.
  useEffect(() => {
    if (!v.noteIsCustom && v.note !== autoNote) setValue('note', autoNote);
  }, [autoNote, v.noteIsCustom, v.note, setValue]);

  // New invoice for a client: use their default currency.
  const [lastClient, setLastClient] = useState(v.client);
  useEffect(() => {
    if (isEdit || v.client === lastClient) return;
    setLastClient(v.client);
    const c = clientList.find((x) => x._id === v.client);
    if (c?.defaultCurrency && c.defaultCurrency !== v.currency) setValue('currency', c.defaultCurrency);
  }, [v.client, lastClient, clientList, isEdit, v.currency, setValue]);

  const assets = useMemo(() => previewAssets(settings), [settings]);
  const html = useMemo(() => renderInvoice(model, { settings, assets }), [model, settings, assets]);

  // Only an invoice with nothing received yet can be saved as already paid.
  const canMarkPaid = !isQuote && (!isEdit || invoice.amountPaid + invoice.tdsAmount === 0);
  const savingPaid = canMarkPaid && v.paidOn;

  // "Due" follows what is left once the past payments are counted, until the person types their own.
  const paidAll = savingPaid && model.total > 0 && paidPayments(v).reduce((sum, r) => sum + r.amount + r.tds, 0) >= model.total;
  const autoDue = [settings.invoiceDefaults?.dueText, 'Paid', 'On receipt'];
  useEffect(() => {
    if (!savingPaid || v.dueType !== 'text' || !autoDue.includes(v.dueText)) return;
    const want = paidAll ? 'Paid' : 'On receipt';
    if (v.dueText !== want) setValue('dueText', want);
  }, [savingPaid, paidAll, v.dueType, v.dueText]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (status) =>
    handleSubmit(async (values) => {
      try {
        const payload = toPayload({ ...values, paidOn: savingPaid }, { status, lockedNumber: hasNumber, docType });
        const { data } = isEdit ? await api.put(`/${D.base}/${invoice._id}`, payload) : await api.post(`/${D.base}`, payload);
        const doc = data.invoice || data.quote;
        await qc.invalidateQueries({ queryKey: [D.base] });
        await qc.invalidateQueries({ queryKey: ['clients'] });
        if (data.payments?.length) {
          await qc.invalidateQueries({ queryKey: ['payments'] });
          const receipts = data.payments.map((p) => p.receiptNumber).join(', ');
          toast.success(`${D.Title} ${doc.number} saved · ${doc.status === 'paid' ? 'paid in full' : `${formatMoney(doc.balanceDue, doc.currency)} still due`}`, {
            description: `${data.payments.length === 1 ? 'Receipt' : 'Receipts'} ${receipts}`,
          });
        } else {
          toast.success(doc.number ? `${D.Title} ${doc.number} ${isEdit ? 'saved' : 'created'}` : 'Draft saved (it gets a number when you finalise it)');
        }
        navigate(`/${D.base}/${doc._id}`);
      } catch (err) {
        if (!applyServerErrors(err, setError)) toast.error(errorMessage(err));
      }
    }, (errors) => {
      if (import.meta.env.DEV) console.warn('Invoice form errors', errors);
      const first = firstError(errors);
      toast.error(first ? `${first.label}: ${first.message}` : 'Fix the highlighted fields');
    });

  const sym = currencySymbol(v.currency).trim();
  const gstAvailable = !!settings.gst.enabled;

  return (
    <form onSubmit={(ev) => ev.preventDefault()} noValidate>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to={isEdit ? `/${D.base}/${invoice._id}` : `/${D.base}`} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-body">
            <ArrowLeft className="size-3.5" /> {isEdit ? `Back to ${D.lower}` : `${D.Title}s`}
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-ink">{isEdit ? `Edit ${D.lower} ${invoice.number || '(draft)'}` : `New ${D.lower}`}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="xl:hidden" onClick={() => setShowPreview((s) => !s)}>
            {showPreview ? <PencilLine className="size-4" /> : <Eye className="size-4" />} {showPreview ? 'Edit' : 'Preview'}
          </Button>
          {(!isEdit || invoice.status === 'draft') && !savingPaid && (
            <Button variant="secondary" onClick={submit('draft')} loading={formState.isSubmitting}>
              Save draft
            </Button>
          )}
          <Button onClick={submit(isEdit && invoice.status !== 'draft' ? undefined : 'sent')} loading={formState.isSubmitting}>
            {savingPaid ? (paidAll ? 'Save as paid' : 'Save with payments') : isEdit && invoice.status !== 'draft' ? 'Save changes' : 'Save & mark sent'}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <div className={cn('min-w-0 space-y-6', showPreview && 'hidden xl:block')}>
          {/* Client */}
          <Card>
            <CardHeader
              title={isQuote ? 'Prepared for' : 'Billed to'}
              actions={
                !isEdit && (
                  <Segmented
                    value={v.clientMode}
                    onChange={(m) => setValue('clientMode', m)}
                    options={[
                      { value: 'existing', label: 'Saved client' },
                      { value: 'new', label: 'New client' },
                    ]}
                  />
                )
              }
            />
            <div className="px-5 py-5">
              {v.clientMode === 'existing' ? (
                <Field label="Client" error={e.client?.message}>
                  <Select {...register('client')}>
                    <option value="">{clients.isPending ? 'Loading clients…' : 'Choose a client'}</option>
                    {isEdit && !clientList.some((c) => c._id === invoice.client) && <option value={invoice.client}>{invoice.snapshot.client.name}</option>}
                    {clientList.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                        {c.secondaryName ? ` — ${c.secondaryName}` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-xs text-muted"><UserPlus className="size-3.5" /> Saved to your client list when the invoice is saved.</p>
                  <ClientFields register={register} errors={e.newClient || {}} prefix="newClient." compact country={v.newClient?.country} state={v.newClient?.state} />
                </div>
              )}
              {v.clientMode === 'existing' && !clientList.length && !clients.isPending && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Users className="size-3.5" /> No saved clients yet. Switch to “New client”.</p>
              )}
            </div>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader title={`${D.Title} details`} />
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
              <Field
                label={`${D.Title} number`}
                error={e.number?.message}
                hint={!hasNumber && (v.numberMode === 'auto' ? 'Given when you finalise (Save & mark sent). Drafts stay unnumbered, so no gaps.' : 'Must be unique.')}
              >
                {hasNumber ? (
                  <Input value={invoice.number} readOnly className="bg-panel font-mono" />
                ) : v.numberMode === 'auto' ? (
                  <div className="flex gap-2">
                    <Input value={next.data?.number ?? '…'} readOnly className="bg-panel font-mono" />
                    <Button variant="ghost" size="sm" className="h-9.5" onClick={() => { setValue('numberMode', 'manual'); setValue('number', next.data?.number || ''); }}>
                      Override
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input {...register('number')} className="font-mono" autoFocus />
                    <Button variant="ghost" size="sm" className="h-9.5" onClick={() => setValue('numberMode', 'auto')}>Auto</Button>
                  </div>
                )}
              </Field>
              <Field label={`${D.Title} date`} error={e.issueDate?.message}>
                <Input type="date" {...register('issueDate')} />
              </Field>
              {isQuote ? (
                <Field label="Valid until" error={e.validUntil?.message} hint={`Defaults to ${settings.quoteDefaults?.validityDays ?? 15} days. After this the quote shows as expired.`} className="sm:col-span-2">
                  <Input type="date" {...register('validUntil')} />
                </Field>
              ) : (
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold">Due</span>
                  <Segmented value={v.dueType} onChange={(t) => setValue('dueType', t)} options={[{ value: 'text', label: 'Text' }, { value: 'date', label: 'Date' }]} />
                </div>
                {v.dueType === 'text' ? (
                  <Field error={e.dueText?.message}>
                    <Input {...register('dueText')} placeholder="On receipt (advance)" aria-label="Due text" />
                  </Field>
                ) : (
                  <Field error={e.dueDate?.message} hint="Unpaid invoices become overdue after this date.">
                    <Input type="date" {...register('dueDate')} aria-label="Due date" />
                  </Field>
                )}
              </div>
              )}
              <Field label="Currency">
                {isEdit && invoice.amountPaid > 0 ? (
                  <Input value={v.currency} readOnly className="bg-panel" />
                ) : (
                  <Select {...register('currency')}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                )}
              </Field>
              {v.currency !== 'INR' && (
                <Field label={`1 ${v.currency} = ₹`} error={e.exchangeRate?.message} hint="Used to convert this invoice to INR in reports.">
                  <Input inputMode="decimal" {...register('exchangeRate')} />
                </Field>
              )}
            </div>
          </Card>

          <ItemsEditor control={control} register={register} errors={e} currency={v.currency} gst={gstAvailable && v.gstEnabled} />

          <HandoverCard register={register} v={v} setValue={setValue} errors={e} />

          {canMarkPaid && <AlreadyPaidCard control={control} register={register} v={v} setValue={setValue} errors={e} banks={banks} total={model.total} />}

          {/* Totals & split */}
          <Card>
            <CardHeader title="Discount, tax and payment split" />
            <div className="space-y-5 px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Discount" error={e.discountValue?.message}>
                  <div className="flex gap-2">
                    <Select {...register('discountType')} className="w-24 shrink-0" aria-label="Discount type">
                      <option value="amount">{sym}</option>
                      <option value="percent">%</option>
                    </Select>
                    <Input inputMode="decimal" {...register('discountValue')} placeholder="0" aria-label="Discount value" />
                  </div>
                </Field>
                {gstAvailable ? (
                  <div className="space-y-2">
                    <Switch checked={v.gstEnabled} onChange={(on) => setValue('gstEnabled', on)} label="Charge GST" description={model.gst.enabled ? (model.gst.mode === 'inter' ? 'IGST (other state)' : 'CGST + SGST (same state)') : 'Off for this invoice'} />
                    {v.gstEnabled && (
                      <Field label="GST rate (%)">
                        <Input inputMode="decimal" {...register('gstRate')} className="w-28" />
                      </Field>
                    )}
                  </div>
                ) : (
                  <p className="self-end text-xs text-muted">GST is off. Turn it on in Settings → GST & defaults.</p>
                )}
              </div>

              <div className="rounded-xl border border-line/80 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold">Payment split</p>
                  {savingPaid ? (
                    <span className="text-xs text-muted">Full payment (already paid)</span>
                  ) : (
                    <Segmented value={v.splitType} onChange={(t) => setValue('splitType', t)} options={[{ value: 'full', label: 'Full payment' }, { value: 'advance', label: 'Advance + balance' }]} />
                  )}
                </div>
                {v.splitType === 'advance' && (
                  <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                    <Field label="Advance as">
                      <Segmented value={v.advanceBy} onChange={(t) => { setValue('advanceBy', t); setValue('advanceValue', ''); }} options={[{ value: 'percent', label: '%' }, { value: 'amount', label: sym }]} />
                    </Field>
                    <Field label={v.advanceBy === 'percent' ? 'Advance (%)' : `Advance (${sym})`} error={e.advanceValue?.message}>
                      {v.advanceBy === 'percent' ? <Input inputMode="decimal" {...register('advanceValue')} className="w-28" /> : <MoneyInput symbol={sym} {...register('advanceValue')} />}
                    </Field>
                  </div>
                )}
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                  <div><dt className="text-xs text-muted">Total</dt><dd className="font-bold tabular-nums">{formatMoney(model.total, v.currency)}</dd></div>
                  {v.splitType === 'advance' && (
                    <>
                      <div><dt className="text-xs text-muted">Due now</dt><dd className="font-bold text-brand-600 tabular-nums">{formatMoney(model.split.advanceAmount, v.currency)}</dd></div>
                      <div><dt className="text-xs text-muted">On completion</dt><dd className="font-bold tabular-nums">{formatMoney(model.split.balanceAmount, v.currency)}</dd></div>
                    </>
                  )}
                </dl>
              </div>
            </div>
          </Card>

          {/* Bank + note */}
          <Card>
            <CardHeader title="Payment details and note" />
            <div className="space-y-4 px-5 py-5">
              <Field label="Bank account" hint={bank?.kind === 'bank' ? [bank.bankName, bank.accountNumber && `A/c ${bank.accountNumber}`, bank.upiId].filter(Boolean).join(' · ') : 'Printed in Payment Details.'}>
                <Select {...register('bankAccount')}>
                  <option value="">None</option>
                  {banks.filter((b) => b.kind === 'bank').map((b) => (
                    <option key={b._id} value={b._id}>{b.label}{b.isDefault ? ' (default)' : ''}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Note"
                error={e.note?.message}
                hint={v.noteIsCustom ? 'Custom note. It no longer updates when the split changes.' : 'Written from the payment split. Edit it to customise.'}
              >
                <Textarea rows={3} {...register('note', { onChange: () => setValue('noteIsCustom', true) })} />
              </Field>
              {v.noteIsCustom && (
                <Button variant="ghost" size="sm" onClick={() => { setValue('noteIsCustom', false); setValue('note', autoNote); }}>
                  <RotateCcw className="size-3.5" /> Use automatic note
                </Button>
              )}
              <Field label="Terms & conditions" hint="One per line. Defaults come from Settings → GST & defaults.">
                <Textarea rows={3} {...register('terms')} />
              </Field>
            </div>
          </Card>
        </div>

        <div className={cn('min-w-0 xl:sticky xl:top-6', !showPreview && 'hidden xl:block')}>
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span className="font-bold tracking-wider uppercase">Live preview</span>
            <span>Same template as the PDF</span>
          </div>
          <DocumentPreview html={html} />
        </div>
      </div>
    </form>
  );
}

export function InvoiceEditorPage({ docType = 'invoice' }) {
  const { id } = useParams();
  const settings = useSettings();
  const banks = useBankAccounts();
  const invoice = useInvoice(docType === 'invoice' ? id : undefined);
  const quote = useQuote(docType === 'quote' ? id : undefined);
  const doc = docType === 'quote' ? quote : invoice;

  // Paid / cancelled invoices and accepted / declined / converted quotes are locked.
  if (id && doc.data && DOCS[docType].locked.includes(doc.data.status)) {
    return <Navigate to={`/${DOCS[docType].base}/${id}`} replace />;
  }

  return (
    <QueryState query={settings}>
      {(s) => (
        <QueryState query={banks}>
          {(b) =>
            id ? (
              <QueryState query={doc}>{(d) => <Editor key={d._id} settings={s} invoice={d} banks={b} docType={docType} />}</QueryState>
            ) : (
              <Editor key={docType} settings={s} banks={b} docType={docType} />
            )
          }
        </QueryState>
      )}
    </QueryState>
  );
}
