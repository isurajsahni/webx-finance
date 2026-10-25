import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from '@webx/shared/constants.js';
import { fromMinor, toMinor } from '@webx/shared/money.js';
import { toDateInput, todayISO } from '@webx/shared/fy.js';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { useBankAccounts, useClients, useExpenseCategories, useTeam } from '@/api/hooks';
import { useAuth } from '@/features/auth/AuthContext';
import { FilesField, toRequestBody } from '@/components/FilesField';
import { LinesEditor } from '@/components/LinesEditor';
import { Button, Field, Input, ModalFooter, Select, Switch, Textarea } from '@/components/ui';

const line = z.object({
  description: z.string().trim().max(200),
  amount: z.string().refine((v) => v.trim() === '' || (toMinor(v) !== null && toMinor(v) >= 0), 'Invalid amount'),
});

const schema = z
  .object({
    kind: z.enum(['expense', 'reimbursement']),
    date: z.string().min(1, 'Pick a date'),
    category: z.string().min(1, 'Choose a category'),
    vendor: z.string().trim().max(120),
    description: z.string().trim().max(1000),
    lines: z.array(line).min(1),
    mode: z.string(),
    reference: z.string().trim().max(80),
    paidFrom: z.string(),
    client: z.string(),
    project: z.string().trim().max(120),
    recurringOn: z.boolean(),
    interval: z.string(),
    nextDueDate: z.string(),
    payeeType: z.enum(['owner', 'member']),
    member: z.string(),
    payeeName: z.string().trim().max(120),
  })
  .superRefine((v, ctx) => {
    const add = (path, message) => ctx.addIssue({ code: 'custom', path, message });
    if (v.lines.reduce((s, l) => s + (toMinor(l.amount) || 0), 0) <= 0) add(['lines'], 'Enter an amount');
    if (v.kind === 'expense') {
      if (!v.vendor) add(['vendor'], 'Who was paid?');
      if (!v.paidFrom) add(['paidFrom'], 'Choose the account');
    } else if (v.payeeType === 'member' && !v.member) add(['member'], 'Choose the team member');
  });

function toForm(kind, doc, defaults) {
  if (!doc) return defaults;
  const r = doc.reimbursement || {};
  return {
    ...defaults,
    date: toDateInput(doc.date),
    category: String(doc.category),
    vendor: doc.vendor || '',
    description: doc.description || '',
    lines: doc.lines.map((l) => ({ description: l.description || '', amount: fromMinor(l.amount) })),
    mode: doc.mode || defaults.mode,
    reference: doc.reference || '',
    paidFrom: doc.paidFrom?._id || doc.paidFrom || '',
    client: doc.client?._id || doc.client || '',
    project: doc.project || '',
    recurringOn: !!doc.recurring?.enabled,
    interval: doc.recurring?.interval || 'monthly',
    nextDueDate: toDateInput(doc.recurring?.nextDueDate),
    payeeType: r.payeeType || 'owner',
    member: r.member ? String(r.member) : '',
    payeeName: r.payeeType === 'owner' ? r.payeeName || '' : '',
  };
}

/** Create/edit a company expense (`kind="expense"`) or a reimbursement claim. */
export function ExpenseForm({ kind = 'expense', doc, onDone, onCancel }) {
  const { user } = useAuth();
  const isClaim = kind === 'reimbursement';
  const categories = useExpenseCategories();
  const accounts = useBankAccounts();
  const clients = useClients({ limit: 200, archived: '0' });
  const team = useTeam({ limit: 200, active: '1' });
  const [files, setFiles] = useState([]);
  const [keep, setKeep] = useState(() => (doc?.bills || []).map((b) => b.key));

  const defaultAccount = accounts.data?.find((a) => a.isDefault)?._id || '';
  const defaults = {
    kind,
    date: todayISO(),
    category: '',
    vendor: '',
    description: '',
    lines: [{ description: '', amount: '' }],
    mode: 'upi',
    reference: '',
    paidFrom: defaultAccount,
    client: '',
    project: '',
    recurringOn: false,
    interval: 'monthly',
    nextDueDate: '',
    payeeType: 'owner',
    member: '',
    payeeName: '',
  };

  const { register, control, handleSubmit, setValue, formState, setError } = useForm({ resolver: zodResolver(schema), defaultValues: toForm(kind, doc, defaults) });
  const v = useWatch({ control });
  const e = formState.errors;

  // Accounts may load after the form opens: fill the default then.
  useEffect(() => {
    if (!doc && !v.paidFrom && defaultAccount) setValue('paidFrom', defaultAccount);
  }, [doc, v.paidFrom, defaultAccount, setValue]);

  const onSubmit = async (vals) => {
    const lines = vals.lines.filter((l) => l.description || l.amount).map((l) => ({ description: l.description, amount: toMinor(l.amount) || 0 }));
    const common = {
      date: vals.date,
      category: vals.category,
      vendor: vals.vendor,
      description: vals.description,
      lines,
      client: vals.client || null,
      project: vals.project,
      ...(doc ? { keepBills: keep } : {}),
    };
    const data = isClaim
      ? { ...common, payeeType: vals.payeeType, member: vals.payeeType === 'member' ? vals.member : null, payeeName: vals.payeeType === 'owner' ? vals.payeeName : '' }
      : {
          ...common,
          mode: vals.mode,
          reference: vals.reference,
          paidFrom: vals.paidFrom,
          recurring: vals.recurringOn ? { enabled: true, interval: vals.interval, nextDueDate: vals.nextDueDate || null } : { enabled: false },
        };
    const base = isClaim ? '/reimbursements' : '/expenses';
    try {
      const body = toRequestBody(data, files);
      const res = doc ? await api.put(`${base}/${doc._id}`, body) : await api.post(base, body);
      onDone(res.data.expense || res.data.reimbursement);
    } catch (err) {
      if (!applyServerErrors(err, setError)) setError('root', { message: errorMessage(err) });
    }
  };

  const catOptions = categories.data || [];
  const currentCatHidden = doc && !catOptions.some((c) => c._id === String(doc.category));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {e.root && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{e.root.message}</p>}

      {isClaim && (
        <div className="rounded-xl border border-line/80 p-4">
          <p className="mb-3 text-[13px] font-semibold">Who paid personally?</p>
          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <Select {...register('payeeType')} aria-label="Payee type">
              <option value="owner">Me (owner)</option>
              <option value="member">A team member</option>
            </Select>
            {v.payeeType === 'member' ? (
              <Field error={e.member?.message}>
                <Select {...register('member')} aria-label="Team member">
                  <option value="">{team.isPending ? 'Loading…' : 'Choose team member'}</option>
                  {team.data?.items.map((m) => <option key={m._id} value={m._id}>{m.name}{m.role ? ` · ${m.role}` : ''}</option>)}
                </Select>
              </Field>
            ) : (
              <Field hint={`Leave blank to use “${user.name}”.`}>
                <Input {...register('payeeName')} placeholder={user.name} aria-label="Payee name" />
              </Field>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={isClaim ? 'Date spent' : 'Date'} required error={e.date?.message}>
          <Input type="date" {...register('date')} />
        </Field>
        <Field label="Category" required error={e.category?.message}>
          <Select {...register('category')}>
            <option value="">{categories.isPending ? 'Loading…' : 'Choose a category'}</option>
            {currentCatHidden && <option value={String(doc.category)}>{doc.categoryName} (hidden)</option>}
            {catOptions.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label={isClaim ? 'Spent at (vendor)' : 'Paid to (vendor)'} required={!isClaim} error={e.vendor?.message} className="sm:col-span-2">
          <Input {...register('vendor')} placeholder={isClaim ? 'e.g. Uber, Amazon' : 'e.g. Figma, GoDaddy, landlord'} />
        </Field>
      </div>

      <div>
        <p className="mb-1.5 text-[13px] font-semibold">Lines <span className="font-normal text-muted">(one line is fine; split if the bill has several items)</span></p>
        <LinesEditor control={control} register={register} errors={e} name="lines" labelPlaceholder="What was it for?" />
      </div>

      {!isClaim && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Mode">
            <Select {...register('mode')}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>)}
            </Select>
          </Field>
          <Field label="Paid from" required error={e.paidFrom?.message}>
            <Select {...register('paidFrom')}>
              <option value="">Choose account</option>
              {accounts.data?.map((a) => <option key={a._id} value={a._id}>{a.label}</option>)}
            </Select>
          </Field>
          <Field label="Reference" error={e.reference?.message}>
            <Input {...register('reference')} placeholder="Txn / invoice no." />
          </Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client (optional)" hint="Link project costs to a client.">
          <Select {...register('client')}>
            <option value="">None</option>
            {clients.data?.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Project (optional)" error={e.project?.message}>
          <Input {...register('project')} />
        </Field>
      </div>

      <Field label="Notes" error={e.description?.message} hint="Printed on the voucher.">
        <Textarea rows={2} {...register('description')} />
      </Field>

      {!isClaim && (
        <div className="rounded-xl border border-line/80 p-4">
          <Switch checked={v.recurringOn} onChange={(on) => setValue('recurringOn', on)} label="Recurring subscription" description="Shows up as due so you can record the next one with a click." />
          {v.recurringOn && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Repeats">
                <Select {...register('interval')}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </Select>
              </Field>
              <Field label="Next due" hint="Blank = one interval after the date above.">
                <Input type="date" {...register('nextDueDate')} />
              </Field>
            </div>
          )}
        </div>
      )}

      <Field label="Bills / receipts">
        <FilesField
          existing={(doc?.bills || []).filter((b) => keep.includes(b.key))}
          onRemoveExisting={(key) => setKeep(keep.filter((k) => k !== key))}
          files={files}
          onFiles={setFiles}
          onError={(msg) => setError('root', { message: msg })}
        />
      </Field>

      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={formState.isSubmitting}>{doc ? 'Save' : isClaim ? 'Submit claim' : 'Add expense'}</Button>
      </ModalFooter>
    </form>
  );
}
