import { useEffect, useRef } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Upload } from 'lucide-react';
import { api, applyServerErrors } from '@/api/client';
import { useApiMutation, useSettings } from '@/api/hooks';
import { Button, Card, CardHeader, Field, Input, QueryState, Textarea } from '@/components/ui';
import { GSTIN_RX, PAN_RX, optPattern, optUpperPattern } from '@/lib/validation';

const schema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(100),
  tagline: z.string().trim().max(150),
  address: z.string().trim().max(300),
  state: z.string().trim().max(60),
  stateCode: optPattern(/^\d{2}$/, 'Two digits, e.g. 03'),
  country: z.string().trim().max(60),
  phones: z.array(z.object({ value: z.string().trim().min(5, 'Too short').max(25) })).max(5),
  email: z.union([z.literal(''), z.email('Enter a valid email')]),
  website: z.string().trim().max(120),
  gstin: optUpperPattern(GSTIN_RX, 'Invalid GSTIN'),
  pan: optUpperPattern(PAN_RX, 'Invalid PAN'),
});

const toForm = (c) => ({
  name: c.name ?? '',
  tagline: c.tagline ?? '',
  address: c.address ?? '',
  state: c.state ?? '',
  stateCode: c.stateCode ?? '',
  country: c.country ?? '',
  phones: (c.phones ?? []).map((value) => ({ value })),
  email: c.email ?? '',
  website: c.website ?? '',
  gstin: c.gstin ?? '',
  pan: c.pan ?? '',
});

function LogoCard({ company }) {
  const input = useRef(null);
  const upload = useApiMutation(
    (file) => {
      const fd = new FormData();
      fd.append('logo', file);
      return api.post('/settings/logo', fd);
    },
    { invalidate: [['settings']], success: 'Logo updated' },
  );
  const remove = useApiMutation(() => api.delete('/settings/logo'), { invalidate: [['settings']], success: 'Logo reset to default' });

  return (
    <Card>
      <CardHeader title="Logo" description="Square SVG or PNG. Used on every PDF and in the app." />
      <div className="flex flex-col items-center gap-4 px-5 py-6">
        <div className="grid size-28 place-items-center rounded-2xl border border-line bg-panel p-2">
          <img src={company.logoUrl} alt="Company logo" className="max-h-full max-w-full rounded-[22%]" />
        </div>
        <input
          ref={input}
          type="file"
          accept="image/svg+xml,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
            e.target.value = '';
          }}
        />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => input.current?.click()} loading={upload.isPending}>
            <Upload className="size-3.5" /> Upload
          </Button>
          {company.logo && (
            <Button variant="ghost" size="sm" onClick={() => remove.mutate()} loading={remove.isPending}>
              Use default
            </Button>
          )}
        </div>
        <p className="text-center text-xs text-muted">{company.logo ? company.logo.originalName : 'Showing the default {X} mark'}</p>
      </div>
    </Card>
  );
}

function SignatureCard({ company }) {
  const input = useRef(null);
  const upload = useApiMutation(
    (file) => {
      const fd = new FormData();
      fd.append('signature', file);
      return api.post('/settings/signature', fd);
    },
    { invalidate: [['settings']], success: 'Signature saved' },
  );
  const remove = useApiMutation(() => api.delete('/settings/signature'), { invalidate: [['settings']], success: 'Signature removed' });
  return (
    <Card>
      <CardHeader title="Authorised signature" description="Printed above “Authorised Signatory” on invoices. A PNG with a transparent background looks best." />
      <div className="flex flex-col items-center gap-3 px-5 py-5">
        <div className="grid h-20 w-full place-items-center rounded-xl border border-dashed border-line bg-white p-2">
          {company.signatureUrl ? <img src={company.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted">No signature: a blank line is left to sign by hand</span>}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/svg+xml,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = '';
          }}
        />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => input.current?.click()} loading={upload.isPending}><Upload className="size-3.5" /> {company.signatureUrl ? 'Replace' : 'Upload'}</Button>
          {company.signatureUrl && <Button variant="ghost" size="sm" onClick={() => remove.mutate()} loading={remove.isPending}>Remove</Button>}
        </div>
      </div>
    </Card>
  );
}

function CompanyForm({ company }) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: toForm(company) });
  const { register, handleSubmit, formState, reset, control, setError } = form;
  const phones = useFieldArray({ control, name: 'phones' });
  const e = formState.errors;

  useEffect(() => reset(toForm(company)), [company, reset]);

  const save = useApiMutation((body) => api.put('/settings/company', body), {
    invalidate: [['settings']],
    success: 'Company profile saved',
    toastError: false,
  });

  const onSubmit = (values) =>
    save.mutateAsync({ ...values, phones: values.phones.map((p) => p.value) }).catch((err) => {
      if (!applyServerErrors(err, setError)) setError('root', { message: err.response?.data?.error?.message || 'Could not save' });
    });

  return (
    <Card>
      <CardHeader title="Company profile" description="Shown in the FROM block and footer of every document." />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-5 py-5" noValidate>
        {e.root && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{e.root.message}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" required error={e.name?.message} className="sm:col-span-2">
            <Input {...register('name')} />
          </Field>
          <Field label="Tagline" error={e.tagline?.message} className="sm:col-span-2">
            <Input {...register('tagline')} />
          </Field>
          <Field label="Address" error={e.address?.message} className="sm:col-span-2">
            <Textarea rows={2} {...register('address')} />
          </Field>
          <Field label="State" error={e.state?.message} hint="Used to decide CGST+SGST vs IGST.">
            <Input {...register('state')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="State code" error={e.stateCode?.message}>
              <Input maxLength={2} {...register('stateCode')} />
            </Field>
            <Field label="Country" error={e.country?.message}>
              <Input {...register('country')} />
            </Field>
          </div>
          <Field label="Email" error={e.email?.message}>
            <Input type="email" {...register('email')} />
          </Field>
          <Field label="Website" error={e.website?.message}>
            <Input {...register('website')} />
          </Field>
          <Field label="GSTIN" error={e.gstin?.message} hint="Optional">
            <Input className="uppercase" {...register('gstin')} />
          </Field>
          <Field label="PAN" error={e.pan?.message} hint="Optional">
            <Input className="uppercase" {...register('pan')} />
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold">Phone numbers</p>
          <div className="space-y-2">
            {phones.fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2">
                <Field error={e.phones?.[i]?.value?.message} className="flex-1">
                  <Input {...register(`phones.${i}.value`)} placeholder="+91 98765 43210" />
                </Field>
                <Button variant="ghost" size="icon" className="mt-1" onClick={() => phones.remove(i)} aria-label="Remove phone">
                  <Trash2 className="size-4 text-muted" />
                </Button>
              </div>
            ))}
            {phones.fields.length < 5 && (
              <Button variant="ghost" size="sm" onClick={() => phones.append({ value: '' })}>
                <Plus className="size-3.5" /> Add phone
              </Button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line/60 pt-4">
          <Button variant="secondary" disabled={!formState.isDirty} onClick={() => reset(toForm(company))}>
            Discard
          </Button>
          <Button type="submit" loading={formState.isSubmitting} disabled={!formState.isDirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function CompanyTab() {
  const settings = useSettings();
  return (
    <QueryState query={settings}>
      {(s) => (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_280px]">
          <CompanyForm company={s.company} />
          <div className="space-y-6">
            <LogoCard company={s.company} />
            <SignatureCard company={s.company} />
          </div>
        </div>
      )}
    </QueryState>
  );
}
