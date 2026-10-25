import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader } from '@/components/ui';
import { passwordRule } from '@/lib/validation';
import { useAuth } from './AuthContext';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordRule,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export function AccountPage() {
  const { user } = useAuth();
  const { register, handleSubmit, formState, reset, setError } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed. Other devices have been signed out.');
      reset();
    } catch (err) {
      if (!applyServerErrors(err, setError)) toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Your account" />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Profile" />
          <dl className="space-y-3 px-5 py-4 text-sm">
            <div><dt className="text-muted">Name</dt><dd className="font-semibold">{user.name}</dd></div>
            <div><dt className="text-muted">Email</dt><dd className="font-semibold">{user.email}</dd></div>
            <div><dt className="text-muted">Role</dt><dd><Badge tone={user.role === 'owner' ? 'brand' : 'neutral'}>{user.role}</Badge></dd></div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Change password" description="Changing your password signs you out on all other devices." />
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-5 py-5" noValidate>
            <Field label="Current password" error={formState.errors.currentPassword?.message}>
              <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
            </Field>
            <Field label="New password" error={formState.errors.newPassword?.message} hint="At least 10 characters, with a letter and a number.">
              <Input type="password" autoComplete="new-password" {...register('newPassword')} />
            </Field>
            <Field label="Confirm new password" error={formState.errors.confirm?.message}>
              <Input type="password" autoComplete="new-password" {...register('confirm')} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={formState.isSubmitting}>Update password</Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
