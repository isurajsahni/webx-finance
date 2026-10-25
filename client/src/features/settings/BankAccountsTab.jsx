import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Banknote, Landmark, Pencil, Plus, Star } from 'lucide-react';
import { fromMinor, toMinor, formatMoney } from '@webx/shared/money.js';
import { toDateInput } from '@webx/shared/fy.js';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { useApiMutation, useBankAccounts } from '@/api/hooks';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, ModalFooter, MoneyInput, QueryState, Select, Switch } from '@/components/ui';
import { IFSC_RX, UPI_RX, moneyString, optPattern, optUpperPattern } from '@/lib/validation';

const schema = z
  .object({
    kind: z.enum(['bank', 'cash']),
    label: z.string().trim().min(1, 'Give this account a name').max(80),
    payableTo: z.string().trim().max(100),
    bankName: z.string().trim().max(100),
    branch: z.string().trim().max(100),
    accountNumber: optUpperPattern(/^[0-9A-Z]{6,20}$/, '6–20 letters or digits, no spaces'),
    ifsc: optUpperPattern(IFSC_RX, 'Invalid IFSC, e.g. HDFC0001234'),
    swift: optUpperPattern(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'Invalid SWIFT code'),
    upiId: optPattern(UPI_RX, 'Invalid UPI ID, e.g. name@okhdfcbank'),
    openingBalance: moneyString({ allowNegative: true }),
    openingDate: z.string(),
    isDefault: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'bank' && !v.bankName && !v.upiId) ctx.addIssue({ code: 'custom', path: ['bankName'], message: 'Add a bank name or a UPI ID' });
  });

const empty = { kind: 'bank', label: '', payableTo: '', bankName: '', branch: '', accountNumber: '', ifsc: '', swift: '', upiId: '', openingBalance: '', openingDate: '', isDefault: false };

const toForm = (a) => ({
  ...empty,
  ...Object.fromEntries(Object.keys(empty).map((k) => [k, a[k] ?? empty[k]])),
  openingBalance: a.openingBalance ? fromMinor(a.openingBalance) : '',
  openingDate: toDateInput(a.openingDate),
});

function AccountForm({ account, onDone, onCancel }) {
  const editing = !!account?._id;
  const { register, handleSubmit, watch, setValue, formState, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: account ? toForm(account) : empty,
  });
  const kind = watch('kind');
  const e = formState.errors;

  const onSubmit = async (v) => {
    const body = { ...v, openingBalance: toMinor(v.openingBalance) ?? 0, openingDate: v.openingDate || null };
    try {
      if (editing) await api.put(`/bank-accounts/${account._id}`, body);
      else await api.post('/bank-accounts', body);
      onDone(true);
    } catch (err) {
      if (!applyServerErrors(err, setError)) setError('root', { message: errorMessage(err) });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {e.root && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{e.root.message}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          {account?.isSystem ? (
            <Input value="Cash (system account)" readOnly />
          ) : (
            <Select {...register('kind')}>
              <option value="bank">Bank / UPI</option>
              <option value="cash">Cash</option>
            </Select>
          )}
        </Field>
        <Field label="Label" required error={e.label?.message} hint="Only you see this, e.g. “HDFC Current”.">
          <Input {...register('label')} />
        </Field>
        {kind === 'bank' && (
          <>
            <Field label="Payable to" error={e.payableTo?.message} hint="Account holder name printed on invoices." className="sm:col-span-2">
              <Input {...register('payableTo')} />
            </Field>
            <Field label="Bank name" error={e.bankName?.message}>
              <Input {...register('bankName')} />
            </Field>
            <Field label="Branch" error={e.branch?.message}>
              <Input {...register('branch')} />
            </Field>
            <Field label="Account number" error={e.accountNumber?.message}>
              <Input className="font-mono uppercase" autoComplete="off" {...register('accountNumber')} />
            </Field>
            <Field label="IFSC" error={e.ifsc?.message}>
              <Input className="font-mono uppercase" {...register('ifsc')} />
            </Field>
            <Field label="UPI ID" error={e.upiId?.message}>
              <Input {...register('upiId')} />
            </Field>
            <Field label="SWIFT" error={e.swift?.message} hint="For international clients (optional).">
              <Input className="font-mono uppercase" {...register('swift')} />
            </Field>
          </>
        )}
        <Field label="Opening balance" error={e.openingBalance?.message} hint="Balance before you started using this app.">
          <MoneyInput {...register('openingBalance')} placeholder="0" />
        </Field>
        <Field label="Opening balance date" error={e.openingDate?.message}>
          <Input type="date" {...register('openingDate')} />
        </Field>
      </div>
      {account?.isActive !== false && kind === 'bank' && (
        <Switch checked={watch('isDefault')} onChange={(v) => setValue('isDefault', v, { shouldDirty: true })} label="Default account" description="Pre-selected on new invoices." />
      )}
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={formState.isSubmitting}>Save account</Button>
      </ModalFooter>
    </form>
  );
}

function AccountRow({ a, onEdit }) {
  const opts = { invalidate: [['bank-accounts']] };
  const makeDefault = useApiMutation(() => api.post(`/bank-accounts/${a._id}/default`), { ...opts, success: `${a.label} is now the default` });
  const toggle = useApiMutation(() => api.post(`/bank-accounts/${a._id}/${a.isActive ? 'deactivate' : 'activate'}`), {
    ...opts,
    success: a.isActive ? 'Account deactivated' : 'Account activated',
  });
  const Icon = a.kind === 'cash' ? Banknote : Landmark;

  return (
    <li className={`flex flex-wrap items-center gap-4 px-5 py-4 ${a.isActive ? '' : 'opacity-60'}`}>
      <div className="grid size-10 place-items-center rounded-lg bg-lavender text-brand-600">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold">{a.label}</p>
          {a.isDefault && <Badge tone="brand">Default</Badge>}
          {a.isSystem && <Badge>System</Badge>}
          {!a.isActive && <Badge tone="amber">Inactive</Badge>}
        </div>
        {a.kind === 'bank' ? (
          <p className="mt-0.5 truncate text-xs text-muted">
            {[a.bankName, a.branch].filter(Boolean).join(', ')}
            {a.accountNumber && <> · A/c <span className="font-mono">{a.accountNumber}</span></>}
            {a.ifsc && <> · <span className="font-mono">{a.ifsc}</span></>}
            {a.upiId && <> · {a.upiId}</>}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted">Cash payments and expenses</p>
        )}
      </div>
      <p className="text-sm text-muted tabular-nums" title="Opening balance">{formatMoney(a.openingBalance)}</p>
      <div className="flex items-center gap-1">
        {a.isActive && !a.isDefault && a.kind === 'bank' && (
          <Button variant="ghost" size="sm" onClick={() => makeDefault.mutate()} loading={makeDefault.isPending} title="Make default">
            <Star className="size-3.5" /> Default
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => onEdit(a)} aria-label={`Edit ${a.label}`}>
          <Pencil className="size-4" />
        </Button>
        {!a.isSystem && (
          <Button variant="ghost" size="sm" onClick={() => toggle.mutate()} loading={toggle.isPending}>
            {a.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        )}
      </div>
    </li>
  );
}

export function BankAccountsTab() {
  const accounts = useBankAccounts({ includeInactive: true });
  const [editing, setEditing] = useState(null); // null | {} (new) | account
  const done = useApiMutation(async () => {}, { invalidate: [['bank-accounts']], success: 'Account saved' });

  return (
    <Card>
      <CardHeader
        title="Bank accounts"
        description="Pick one on each invoice; its details print in Payment Details. Accounts are never deleted, only deactivated."
        actions={
          <Button size="sm" onClick={() => setEditing({})}>
            <Plus className="size-4" /> Add account
          </Button>
        }
      />
      <QueryState query={accounts}>
        {(items) =>
          items.length ? (
            <ul className="divide-y divide-line/60">
              {items.map((a) => (
                <AccountRow key={a._id} a={a} onEdit={setEditing} />
              ))}
            </ul>
          ) : (
            <EmptyState icon={Landmark} title="No accounts yet" description="Add the bank account your clients pay into." />
          )
        }
      </QueryState>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?._id ? `Edit ${editing.label}` : 'Add account'}
        size="lg"
      >
        {editing && (
          <AccountForm
            key={editing._id || 'new'}
            account={editing._id ? editing : null}
            onCancel={() => setEditing(null)}
            onDone={() => {
              done.mutate();
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </Card>
  );
}
