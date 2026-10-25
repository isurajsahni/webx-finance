import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DOC_TYPES, DOC_TYPE_LABELS } from '@webx/shared/constants.js';
import { formatDocNumber } from '@webx/shared/numbering.js';
import { fyLabel } from '@webx/shared/fy.js';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { useApiMutation, useNumberingPreview, useSettings } from '@/api/hooks';
import { Button, Card, CardHeader, Field, Input, QueryState, Select, Switch } from '@/components/ui';

const SHORT_LABELS = { invoice: 'Invoice', receipt: 'Receipt', payslip: 'Payslip', voucher: 'Voucher' };

const config = z.object({
  prefix: z.string().trim().max(20).regex(/^[A-Za-z0-9/_-]*$/, 'Letters, numbers, / _ - only'),
  padding: z.coerce.number().int().min(1).max(8),
  includeFy: z.boolean(),
  separator: z.enum(['/', '-', '']),
});
const schema = z.object(Object.fromEntries(DOC_TYPES.map((t) => [t, config])));

function FormatForm({ numbering, fy }) {
  const { register, handleSubmit, watch, setValue, reset, formState, setError } = useForm({ resolver: zodResolver(schema), defaultValues: numbering });
  useEffect(() => reset(numbering), [numbering, reset]);
  const save = useApiMutation((body) => api.put('/settings/numbering', body), {
    invalidate: [['settings']],
    success: 'Numbering format saved',
    toastError: false,
  });
  const values = watch();

  return (
    <Card>
      <CardHeader title="Number format" description="Numbers restart at 0001 every financial year and are never reused, even if a document is cancelled." />
      <form
        onSubmit={handleSubmit((v) => save.mutateAsync(v).catch((err) => applyServerErrors(err, setError) || setError('root', { message: errorMessage(err) })))}
        noValidate
      >
        {formState.errors.root && <p className="mx-5 mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formState.errors.root.message}</p>}
        <div className="divide-y divide-line/60">
          {DOC_TYPES.map((t) => {
            const e = formState.errors[t] || {};
            const v = values[t] || {};
            return (
              <div key={t} className="grid gap-4 px-5 py-4 md:grid-cols-[180px_1fr_auto] md:items-start">
                <div>
                  <p className="font-bold">{DOC_TYPE_LABELS[t]}</p>
                  <p className="mt-1 font-mono text-sm text-brand-600">{formatDocNumber(1, { ...v, padding: Number(v.padding) || 4 }, fy)}</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Prefix" error={e.prefix?.message}>
                    <Input {...register(`${t}.prefix`)} placeholder="none" />
                  </Field>
                  <Field label="Digits" error={e.padding?.message}>
                    <Input type="number" min={1} max={8} {...register(`${t}.padding`)} />
                  </Field>
                  <Field label="Separator">
                    <Select {...register(`${t}.separator`)}>
                      <option value="/">/</option>
                      <option value="-">-</option>
                      <option value="">none</option>
                    </Select>
                  </Field>
                </div>
                <div className="md:pt-7">
                  <Switch checked={!!v.includeFy} onChange={(on) => setValue(`${t}.includeFy`, on, { shouldDirty: true })} label="Include FY" />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end border-t border-line/60 px-5 py-3">
          <Button type="submit" loading={formState.isSubmitting} disabled={!formState.isDirty}>
            Save format
          </Button>
        </div>
      </form>
    </Card>
  );
}

const nextSchema = z.object({
  type: z.enum(DOC_TYPES),
  fy: z.string().regex(/^\d{4}(-\d{2})?$/, 'Use a financial year like 2026-27'),
  next: z.coerce.number().int('Whole number').min(1, 'Must be at least 1'),
});

function ContinueSeries({ fy }) {
  const preview = useNumberingPreview();
  const { register, handleSubmit, formState, setError, reset } = useForm({ resolver: zodResolver(nextSchema), defaultValues: { type: 'invoice', fy, next: '' } });
  const save = useApiMutation((body) => api.post('/settings/numbering/next', body), {
    invalidate: [['settings', 'numbering-preview']],
    success: (_d, v) => `Next ${v.type} in ${v.fy} will be number ${v.next}`,
    toastError: false,
  });

  return (
    <Card>
      <CardHeader title="Continue an existing series" description="Moving from another tool? Set where numbering continues. Numbers can only move forward." />
      <div className="grid gap-6 px-5 py-5 lg:grid-cols-[1.3fr_1fr]">
        <form
          onSubmit={handleSubmit((v) =>
            save.mutateAsync(v).then(() => reset({ ...v, next: '' })).catch((err) => applyServerErrors(err, setError) || setError('next', { message: errorMessage(err) })),
          )}
          className="space-y-4"
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
            <Field label="Document">
              <Select {...register('type')}>
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>{SHORT_LABELS[t]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Financial year" error={formState.errors.fy?.message}>
              <Input {...register('fy')} />
            </Field>
            <Field label="Next number" error={formState.errors.next?.message}>
              <Input type="number" min={1} placeholder="e.g. 903" {...register('next')} />
            </Field>
          </div>
          <Button type="submit" variant="dark" loading={formState.isSubmitting}>Set next number</Button>
        </form>
        <div className="rounded-xl bg-panel p-4">
          <p className="label-caps mb-3">Next numbers · FY {fy}</p>
          <QueryState query={preview}>
            {(p) => (
              <dl className="space-y-2 text-sm">
                {DOC_TYPES.map((t) => (
                  <div key={t} className="flex justify-between gap-2">
                    <dt className="text-muted">{SHORT_LABELS[t]}</dt>
                    <dd className="font-mono text-xs font-bold whitespace-nowrap">{p.next[t].number}</dd>
                  </div>
                ))}
              </dl>
            )}
          </QueryState>
        </div>
      </div>
    </Card>
  );
}

export function NumberingTab() {
  const settings = useSettings();
  return (
    <QueryState query={settings}>
      {(s) => {
        const fy = fyLabel(new Date(), s.fyStartMonth);
        return (
          <div className="space-y-6">
            <FormatForm numbering={s.numbering} fy={fy} />
            <ContinueSeries fy={fy} />
          </div>
        );
      }}
    </QueryState>
  );
}
