import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { errorMessage } from '@/api/client';
import { Button } from './Button';

export function Spinner({ className = 'size-5' }) {
  return <Loader2 className={`${className} animate-spin text-brand-500`} aria-label="Loading" />;
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted" role="status">
      <Spinner />
      {label}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-lavender p-3 text-brand-600">
        <Icon className="size-6" aria-hidden />
      </div>
      <p className="font-bold text-body">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Could not load this' }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center" role="alert">
      <div className="mb-3 rounded-full bg-red-50 p-3 text-red-600">
        <AlertTriangle className="size-6" aria-hidden />
      </div>
      <p className="font-bold text-body">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Renders loading / error states for a TanStack query, or the children when ready. */
export function QueryState({ query, loading, children }) {
  if (query.isPending) return loading ?? <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return children(query.data);
}
