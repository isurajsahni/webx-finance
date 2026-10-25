import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { errorMessage } from '@/api/client';
import { Button, Field, Input } from '@/components/ui';
import { useAuth } from './AuthContext';

const schema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const [show, setShow] = useState(false);
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(schema) });

  if (user) return <Navigate to={location.state?.from?.pathname || '/'} replace />;

  const onSubmit = async ({ email, password }) => {
    setServerError('');
    try {
      await login(email, password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setServerError(errorMessage(err));
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -top-40 -right-40 size-[520px] rounded-full bg-brand-500/25 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-11" />
          <div>
            <p className="text-sm font-black tracking-wide text-white uppercase">
              The Web<span className="text-brand-500">{'{X}'}</span> Studio
            </p>
            <p className="text-xs text-white/50">Web Design · Development · Graphic & UI/UX Design</p>
          </div>
        </div>
        <div className="relative">
          <p className="font-mono text-[120px] leading-none font-black text-white/95">
            {'{'}
            <span className="text-brand-500">X</span>
            {'}'}
          </p>
          <p className="mt-6 max-w-sm text-lg text-white/70">Invoices, receipts, payouts and every rupee in and out, in one place.</p>
        </div>
        <p className="relative text-xs text-white/35">Private workspace · Authorised users only</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/favicon.svg" alt="" className="size-10" />
            <p className="text-sm font-black tracking-wide uppercase">
              The Web<span className="text-brand-500">{'{X}'}</span> Studio
            </p>
          </div>
          <Link to="/" className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-body">
            <ArrowLeft className="size-3.5" /> Home
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Welcome back. Enter your details to continue.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
            {serverError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700" role="alert">
                {serverError}
              </div>
            )}
            <Field label="Email" error={formState.errors.email?.message}>
              <Input type="email" autoComplete="username" autoFocus {...register('email')} />
            </Field>
            <Field
              label="Password"
              error={formState.errors.password?.message}
              render={(a11y) => (
                <div className="relative">
                  <Input type={show ? 'text' : 'password'} autoComplete="current-password" className="pr-10" {...a11y} {...register('password')} />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-body"
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            />
            <Button type="submit" className="w-full" loading={formState.isSubmitting}>
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
