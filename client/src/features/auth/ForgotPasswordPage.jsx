import { Link, Navigate, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { Button, Field, Input } from '@/components/ui';
import { passwordRule } from '@/lib/validation';
import { useAuth } from './AuthContext';

const schema = z
  .object({
    email: z.email('Enter a valid email'),
    recoveryKey: z.string().trim().min(1, 'Enter the recovery key'),
    password: passwordRule,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

/**
 * Forgot password without email. The owner proves access with the recovery key
 * (the server's JWT_SECRET); everyone else asks the owner to reset theirs.
 */
export function ForgotPasswordPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { register, handleSubmit, formState, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', recoveryKey: '', password: '', confirm: '' },
  });
  const e = formState.errors;

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async ({ email, recoveryKey, password }) => {
    try {
      const { data } = await api.post('/auth/recover', { email, recoveryKey, password });
      qc.setQueryData(['me'], data.user);
      toast.success('Password changed. You are signed in.');
      navigate('/', { replace: true });
    } catch (err) {
      if (!applyServerErrors(err, setError)) setError('root', { message: errorMessage(err) });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/login" className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-body">
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>
        <div className="card p-6 sm:p-8">
          <span className="grid size-10 place-items-center rounded-lg bg-lavender text-brand-600"><KeyRound className="size-5" /></span>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-ink">Forgot password</h1>
          <p className="mt-1 text-sm text-muted">
            For the owner. Your <b>recovery key</b> is the <code className="rounded bg-panel px-1 text-xs">JWT_SECRET</code> value on your server
            (Render → Environment, use the copy button). Not the owner? Ask the owner to reset your password in Settings → Users.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            {e.root && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700" role="alert">{e.root.message}</p>}
            <Field label="Email" error={e.email?.message} hint="The email you want to sign in with. The owner account is created if it doesn't exist.">
              <Input type="email" autoComplete="username" autoFocus {...register('email')} />
            </Field>
            <Field label="Recovery key" error={e.recoveryKey?.message}>
              <Input type="password" autoComplete="off" {...register('recoveryKey')} />
            </Field>
            <Field label="New password" error={e.password?.message} hint="At least 10 characters, with a letter and a number.">
              <Input type="password" autoComplete="new-password" {...register('password')} />
            </Field>
            <Field label="Confirm new password" error={e.confirm?.message}>
              <Input type="password" autoComplete="new-password" {...register('confirm')} />
            </Field>
            <Button type="submit" className="w-full" loading={formState.isSubmitting}>Set password & sign in</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
