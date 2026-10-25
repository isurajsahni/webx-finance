import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { useApiMutation, useSettings } from '@/api/hooks';
import { HOSTING_PERIODS, MAINTENANCE_PERIODS } from '@webx/shared/handover.js';
import { Button, Card, CardHeader, Field, Input, QueryState, Select, Switch, Textarea } from '@/components/ui';

const schema = z.object({
  baseCurrency: z.literal('INR'),
  gst: z.object({ enabled: z.boolean(), defaultRate: z.coerce.number().min(0, '0–28').max(28, '0–28') }),
  invoiceDefaults: z.object({
    advancePercent: z.coerce.number().min(0, '0–100').max(100, '0–100'),
    dueText: z.string().trim().max(80),
    note: z.string().trim().max(1000),
    thankYouText: z.string().trim().max(120),
    footerText: z.string().trim().max(200),
    terms: z.string().trim().max(2000),
    showSignature: z.boolean(),
  }),
  handoverDefaults: z.object({
    enabledByDefault: z.boolean(),
    hostingMonths: z.string(),
    maintenanceMonths: z.string(),
    includes: z.string().max(4000),
    excludes: z.string().max(4000),
  }),
  quoteDefaults: z.object({
    validityDays: z.coerce.number().int().min(1, '1–365').max(365, '1–365'),
    note: z.string().trim().max(1000),
  }),
});

const lines = (text) => text.split(/\r?\n/).map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean).slice(0, 20);

const pick = (s) => ({
  baseCurrency: s.baseCurrency,
  gst: s.gst,
  invoiceDefaults: s.invoiceDefaults,
  handoverDefaults: {
    enabledByDefault: !!s.handoverDefaults?.enabledByDefault,
    hostingMonths: String(s.handoverDefaults?.hostingMonths ?? 12),
    maintenanceMonths: String(s.handoverDefaults?.maintenanceMonths ?? 3),
    includes: (s.handoverDefaults?.includes || []).join('\n'),
    excludes: (s.handoverDefaults?.excludes || []).join('\n'),
  },
  quoteDefaults: { validityDays: s.quoteDefaults?.validityDays ?? 15, note: s.quoteDefaults?.note ?? '' },
});

const toBody = (v) => ({
  ...v,
  handoverDefaults: {
    enabledByDefault: v.handoverDefaults.enabledByDefault,
    hostingMonths: Number(v.handoverDefaults.hostingMonths),
    maintenanceMonths: Number(v.handoverDefaults.maintenanceMonths),
    includes: lines(v.handoverDefaults.includes),
    excludes: lines(v.handoverDefaults.excludes),
  },
});

function PreferencesForm({ settings }) {
  const { register, handleSubmit, watch, setValue, reset, formState, setError } = useForm({ resolver: zodResolver(schema), defaultValues: pick(settings) });
  useEffect(() => reset(pick(settings)), [settings, reset]);
  const save = useApiMutation((body) => api.put('/settings/preferences', body), { invalidate: [['settings']], success: 'Preferences saved', toastError: false });
  const e = formState.errors;
  const gstOn = watch('gst.enabled');

  return (
    <form
      onSubmit={handleSubmit((v) => save.mutateAsync(toBody(v)).catch((err) => applyServerErrors(err, setError) || setError('root', { message: errorMessage(err) })))}
      className="space-y-6"
      noValidate
    >
      {e.root && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{e.root.message}</p>}
      <Card>
        <CardHeader title="GST" description="When on, invoices show CGST + SGST for clients in your state and IGST for others, with SAC/HSN per line." />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:items-start">
          <Switch checked={gstOn} onChange={(v) => setValue('gst.enabled', v, { shouldDirty: true })} label="Charge GST" description="Off by default. Each invoice can still opt out." />
          <Field label="Default GST rate (%)" error={e.gst?.defaultRate?.message}>
            <Input type="number" step="0.01" min={0} max={28} readOnly={!gstOn} className={gstOn ? '' : 'bg-panel text-muted'} {...register('gst.defaultRate')} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Invoice defaults" description="Pre-filled on every new invoice; you can change them per invoice." />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Base currency" hint="Reports convert everything to INR.">
            <Input value="INR (₹)" readOnly />
          </Field>
          <Field label="Default advance (%)" error={e.invoiceDefaults?.advancePercent?.message}>
            <Input type="number" min={0} max={100} {...register('invoiceDefaults.advancePercent')} />
          </Field>
          <Field label="Default due text" error={e.invoiceDefaults?.dueText?.message} className="sm:col-span-2">
            <Input {...register('invoiceDefaults.dueText')} placeholder="On receipt (advance)" />
          </Field>
          <Field label="Default note" error={e.invoiceDefaults?.note?.message} hint="Leave blank to auto-generate the note from the payment split." className="sm:col-span-2">
            <Textarea rows={3} {...register('invoiceDefaults.note')} />
          </Field>
          <Field label="Thank-you line" error={e.invoiceDefaults?.thankYouText?.message}>
            <Input {...register('invoiceDefaults.thankYouText')} />
          </Field>
          <Field label="Footer text" error={e.invoiceDefaults?.footerText?.message}>
            <Input {...register('invoiceDefaults.footerText')} />
          </Field>
          <Field label="Default terms & conditions" error={e.invoiceDefaults?.terms?.message} hint="One per line; printed as a numbered list. Editable on each invoice." className="sm:col-span-2">
            <Textarea rows={4} {...register('invoiceDefaults.terms')} />
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={watch('invoiceDefaults.showSignature')} onChange={(v) => setValue('invoiceDefaults.showSignature', v, { shouldDirty: true })} label="Authorised signatory block" description="“For The Web{X} Studio / Authorised Signatory” at the bottom of invoices. Upload a signature in Settings → Company." />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Website handover, hosting & maintenance"
          description="Defaults for the handover section on invoices and quotes. Each document keeps its own copy, so later changes here never alter one already issued."
        />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Switch checked={watch('handoverDefaults.enabledByDefault')} onChange={(on) => setValue('handoverDefaults.enabledByDefault', on, { shouldDirty: true })} label="Add to new invoices and quotes by default" description="You can still switch it on or off on each one." />
          </div>
          <Field label="Default free hosting">
            <Select {...register('handoverDefaults.hostingMonths')}>{HOSTING_PERIODS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}</Select>
          </Field>
          <Field label="Default free maintenance">
            <Select {...register('handoverDefaults.maintenanceMonths')}>{MAINTENANCE_PERIODS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}</Select>
          </Field>
          <div />
          <Field label="Included in maintenance" hint="One per line." className="sm:col-span-3 lg:col-span-1">
            <Textarea rows={7} {...register('handoverDefaults.includes')} />
          </Field>
          <Field label="Not included (billed separately)" hint="One per line: new pages, image generation, PDF creation…" className="sm:col-span-3 lg:col-span-2">
            <Textarea rows={7} {...register('handoverDefaults.excludes')} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Quotes" />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-[160px_1fr]">
          <Field label="Valid for (days)" error={e.quoteDefaults?.validityDays?.message}>
            <Input type="number" min={1} max={365} {...register('quoteDefaults.validityDays')} />
          </Field>
          <Field label="Default note on quotes" error={e.quoteDefaults?.note?.message}>
            <Textarea rows={2} {...register('quoteDefaults.note')} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={!formState.isDirty} onClick={() => reset(pick(settings))}>Discard</Button>
        <Button type="submit" loading={formState.isSubmitting} disabled={!formState.isDirty}>Save preferences</Button>
      </div>
    </form>
  );
}

export function PreferencesTab() {
  const settings = useSettings();
  return <QueryState query={settings}>{(s) => <PreferencesForm settings={s} />}</QueryState>;
}
