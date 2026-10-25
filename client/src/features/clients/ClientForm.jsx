import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CURRENCIES } from '@webx/shared/constants.js';
import { INDIAN_STATES, isIndia, stateCodeFor, stateNameFor } from '@webx/shared/india.js';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { Button, Field, Input, ModalFooter, Select, Textarea } from '@/components/ui';
import { GSTIN_RX, PAN_RX, optUpperPattern } from '@/lib/validation';

export const clientSchema = z
  .object({
    name: z.string().trim().min(1, 'Client name is required').max(120),
    secondaryName: z.string().trim().max(160),
    contactPerson: z.string().trim().max(120),
    email: z.union([z.literal(''), z.email('Enter a valid email')]),
    phone: z.string().trim().max(30),
    address: z.string().trim().max(400),
    city: z.string().trim().max(80),
    state: z.string().trim().max(60),
    pincode: z.string().trim().max(12),
    country: z.string().trim().max(60),
    gstin: optUpperPattern(GSTIN_RX, 'Invalid GSTIN'),
    pan: optUpperPattern(PAN_RX, 'Invalid PAN'),
    website: z.string().trim().max(160),
    defaultCurrency: z.enum(CURRENCIES),
    notes: z.string().trim().max(2000),
  })
  .superRefine((v, ctx) => {
    if (isIndia(v.country) && v.pincode && !/^\d{6}$/.test(v.pincode)) ctx.addIssue({ code: 'custom', path: ['pincode'], message: '6 digits' });
    if (isIndia(v.country) && v.gstin && v.state && stateCodeFor(v.state) && v.gstin.slice(0, 2) !== stateCodeFor(v.state)) {
      ctx.addIssue({ code: 'custom', path: ['state'], message: `GSTIN is registered in ${stateNameFor(v.gstin.slice(0, 2)) || 'another state'}` });
    }
  });

export const emptyClient = {
  name: '', secondaryName: '', contactPerson: '', email: '', phone: '', address: '', city: '', state: '', pincode: '',
  country: 'India', gstin: '', pan: '', website: '', defaultCurrency: 'INR', notes: '',
};

export const clientToForm = (c) => Object.fromEntries(Object.keys(emptyClient).map((k) => [k, c?.[k] ?? emptyClient[k]]));

/** Fields shared by the client modal and the inline "new client" block on invoices. */
export function ClientFields({ register, errors = {}, prefix = '', compact = false, country = 'India', state = '' }) {
  const n = (k) => `${prefix}${k}`;
  const india = isIndia(country);
  const unknownState = india && state && !stateCodeFor(state);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name" required error={errors.name?.message}>
          <Input {...register(n('name'))} placeholder="GS Associates" />
        </Field>
        <Field label="Company / secondary name" error={errors.secondaryName?.message}>
          <Input {...register(n('secondaryName'))} placeholder="Gurpreet Singh & Associates" />
        </Field>
        <Field label="Contact person" error={errors.contactPerson?.message}>
          <Input {...register(n('contactPerson'))} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <Input type="tel" {...register(n('phone'))} placeholder="+91 98765 43210" />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register(n('email'))} />
        </Field>
        <Field label="Website" error={errors.website?.message}>
          <Input {...register(n('website'))} placeholder="example.com" />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Billing address</p>
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Street / building" error={errors.address?.message} className="sm:col-span-6">
            <Textarea rows={2} {...register(n('address'))} placeholder="Shop no., building, street, area" />
          </Field>
          <Field label="City" error={errors.city?.message} className="sm:col-span-2">
            <Input {...register(n('city'))} />
          </Field>
          <Field label="State" error={errors.state?.message} hint={india ? 'Decides CGST+SGST or IGST.' : undefined} className="sm:col-span-2">
            {india ? (
              <Select {...register(n('state'))}>
                <option value="">Choose state</option>
                {unknownState && <option value={state}>{state}</option>}
                {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name} ({s.code})</option>)}
              </Select>
            ) : (
              <Input {...register(n('state'))} />
            )}
          </Field>
          <Field label={india ? 'PIN code' : 'Postal code'} error={errors.pincode?.message} className="sm:col-span-2">
            <Input inputMode={india ? 'numeric' : 'text'} maxLength={12} {...register(n('pincode'))} />
          </Field>
          <Field label="Country" error={errors.country?.message} className="sm:col-span-2">
            <Input {...register(n('country'))} />
          </Field>
          <Field label="GSTIN" error={errors.gstin?.message} hint="Optional" className="sm:col-span-2">
            <Input className="uppercase" {...register(n('gstin'))} />
          </Field>
          <Field label="PAN" error={errors.pan?.message} hint="Optional" className="sm:col-span-2">
            <Input className="uppercase" {...register(n('pan'))} />
          </Field>
        </div>
      </div>

      {!compact && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default currency" error={errors.defaultCurrency?.message}>
            <Select {...register(n('defaultCurrency'))}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Notes" error={errors.notes?.message} className="sm:col-span-2">
            <Textarea rows={2} {...register(n('notes'))} />
          </Field>
        </div>
      )}
    </div>
  );
}

export function ClientForm({ client, onDone, onCancel }) {
  const editing = !!client?._id;
  const { register, handleSubmit, formState, setError, control } = useForm({ resolver: zodResolver(clientSchema), defaultValues: clientToForm(client) });
  const [country, state] = useWatch({ control, name: ['country', 'state'] });

  const onSubmit = async (v) => {
    try {
      const { data } = editing ? await api.put(`/clients/${client._id}`, v) : await api.post('/clients', v);
      onDone(data.client);
    } catch (err) {
      if (!applyServerErrors(err, setError)) setError('root', { message: errorMessage(err) });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {formState.errors.root && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formState.errors.root.message}</p>}
      <ClientFields register={register} errors={formState.errors} country={country} state={state} />
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={formState.isSubmitting}>{editing ? 'Save client' : 'Add client'}</Button>
      </ModalFooter>
    </form>
  );
}
