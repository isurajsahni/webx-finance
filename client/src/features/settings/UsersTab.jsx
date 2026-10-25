import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Pencil, Plus, Search, UserRound } from 'lucide-react';
import { formatShortDate } from '@webx/shared/fy.js';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { useApiMutation, useUsers } from '@/api/hooks';
import { useAuth } from '@/features/auth/AuthContext';
import { useDebounced } from '@/hooks/useDebounced';
import { passwordRule } from '@/lib/validation';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, ModalFooter, Pagination, QueryState, Select, Switch, Table, Td, Th } from '@/components/ui';

const ROLE_HELP = {
  owner: 'Full access, including settings, users and cancelling records.',
  accountant: 'Can record invoices, payments and expenses. No settings, no cancelling.',
};

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.email('Enter a valid email'),
  role: z.enum(['owner', 'accountant']),
  password: passwordRule,
});
const editSchema = z.object({ name: z.string().trim().min(1, 'Name is required').max(100), role: z.enum(['owner', 'accountant']), isActive: z.boolean() });
const resetSchema = z.object({ password: passwordRule });

function FormFooter({ onCancel, submitting, label }) {
  return (
    <ModalFooter>
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button type="submit" loading={submitting}>{label}</Button>
    </ModalFooter>
  );
}

function UserForm({ user, onDone, onCancel }) {
  const { user: me } = useAuth();
  const editing = !!user;
  const isSelf = editing && user._id === me._id;
  const { register, handleSubmit, watch, setValue, formState, setError } = useForm({
    resolver: zodResolver(editing ? editSchema : createSchema),
    defaultValues: editing ? { name: user.name, role: user.role, isActive: user.isActive } : { name: '', email: '', role: 'accountant', password: '' },
  });
  const e = formState.errors;
  const role = watch('role');

  const onSubmit = async (v) => {
    try {
      if (editing) await api.put(`/users/${user._id}`, v);
      else await api.post('/users', v);
      onDone(editing ? 'User updated' : 'User added');
    } catch (err) {
      if (!applyServerErrors(err, setError)) setError('root', { message: errorMessage(err) });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {e.root && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{e.root.message}</p>}
      <Field label="Name" required error={e.name?.message}>
        <Input {...register('name')} />
      </Field>
      {!editing && (
        <Field label="Email" required error={e.email?.message}>
          <Input type="email" autoComplete="off" {...register('email')} />
        </Field>
      )}
      <Field label="Role" error={e.role?.message} hint={ROLE_HELP[role]}>
        {isSelf ? (
          <Input value={role} readOnly className="capitalize" />
        ) : (
          <Select {...register('role')}>
            <option value="accountant">Accountant</option>
            <option value="owner">Owner</option>
          </Select>
        )}
      </Field>
      {!editing && (
        <Field label="Temporary password" required error={e.password?.message} hint="Share it privately; they can change it under Your account.">
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </Field>
      )}
      {editing && !isSelf && (
        <Switch checked={watch('isActive')} onChange={(v) => setValue('isActive', v)} label="Active" description="Inactive users cannot sign in and are signed out immediately." />
      )}
      <FormFooter onCancel={onCancel} submitting={formState.isSubmitting} label={editing ? 'Save user' : 'Add user'} />
    </form>
  );
}

function ResetPasswordForm({ user, onDone, onCancel }) {
  const { register, handleSubmit, formState, setError } = useForm({ resolver: zodResolver(resetSchema), defaultValues: { password: '' } });
  const onSubmit = async (v) => {
    try {
      await api.post(`/users/${user._id}/reset-password`, v);
      onDone(`Password reset for ${user.name}. They have been signed out.`);
    } catch (err) {
      if (!applyServerErrors(err, setError)) setError('password', { message: errorMessage(err) });
    }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label="New password" error={formState.errors.password?.message} hint="At least 10 characters, with a letter and a number.">
        <Input type="password" autoComplete="new-password" {...register('password')} />
      </Field>
      <FormFooter onCancel={onCancel} submitting={formState.isSubmitting} label="Reset password" />
    </form>
  );
}

export function UsersTab() {
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const users = useUsers({ page, search: q || undefined, limit: 20 });
  const [modal, setModal] = useState(null); // {mode:'create'|'edit'|'reset', user}
  const done = useApiMutation(async (msg) => msg, { invalidate: [['users']], success: (msg) => msg });
  const close = () => setModal(null);
  const finish = (msg) => {
    done.mutate(msg);
    close();
  };

  return (
    <Card>
      <CardHeader
        title="Users"
        description="People who can sign in to this workspace."
        actions={
          <Button size="sm" onClick={() => setModal({ mode: 'create' })}>
            <Plus className="size-4" /> Add user
          </Button>
        }
      />
      <div className="border-b border-line/60 px-5 py-3">
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or email" className="pl-9" aria-label="Search users" />
        </div>
      </div>
      <QueryState query={users}>
        {(data) =>
          data.items.length ? (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Last sign-in</Th>
                    <Th align="right"><span className="sr-only">Actions</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u._id}>
                      <Td>
                        <p className="font-semibold">{u.name} {u._id === me._id && <span className="text-xs font-normal text-muted">(you)</span>}</p>
                        <p className="text-xs text-muted">{u.email}</p>
                      </Td>
                      <Td><Badge tone={u.role === 'owner' ? 'brand' : 'neutral'}>{u.role}</Badge></Td>
                      <Td>{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Inactive</Badge>}</Td>
                      <Td className="text-muted">{u.lastLoginAt ? formatShortDate(u.lastLoginAt) : 'Never'}</Td>
                      <Td align="right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setModal({ mode: 'edit', user: u })} aria-label={`Edit ${u.name}`}>
                            <Pencil className="size-4" />
                          </Button>
                          {u._id !== me._id && (
                            <Button size="icon" variant="ghost" onClick={() => setModal({ mode: 'reset', user: u })} aria-label={`Reset password for ${u.name}`}>
                              <KeyRound className="size-4" />
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
            </>
          ) : (
            <EmptyState icon={UserRound} title={q ? 'No matching users' : 'No users yet'} />
          )
        }
      </QueryState>

      <Modal
        open={!!modal}
        onClose={close}
        size="sm"
        title={modal?.mode === 'create' ? 'Add user' : modal?.mode === 'edit' ? `Edit ${modal.user.name}` : `Reset password · ${modal?.user?.name}`}
      >
        {modal?.mode === 'reset' ? (
          <ResetPasswordForm user={modal.user} onDone={finish} onCancel={close} />
        ) : modal ? (
          <UserForm key={modal.user?._id || 'new'} user={modal.user} onDone={finish} onCancel={close} />
        ) : null}
      </Modal>
    </Card>
  );
}
