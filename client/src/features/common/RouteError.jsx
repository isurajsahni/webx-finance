import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui';

/** Shown instead of a blank screen when a page crashes or fails to load. */
export function RouteError() {
  const error = useRouteError();
  // After a new deploy, old page chunks no longer exist: a reload fixes it.
  const staleChunk = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(String(error?.message || ''));
  const title = isRouteErrorResponse(error) && error.status === 404 ? 'Page not found' : staleChunk ? 'A new version is available' : 'Something went wrong on this page';
  const body = staleChunk ? 'Reload to get the latest version of the app.' : 'Your data is safe. Try reloading; if it keeps happening, note what you clicked and let the developer know.';
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-red-50 text-red-600"><AlertTriangle className="size-6" /></div>
        <h1 className="text-xl font-black text-ink">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
        {import.meta.env.DEV && error?.message && <pre className="mt-4 overflow-auto rounded-lg bg-panel p-3 text-left text-xs text-red-700">{error.message}</pre>}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}><RotateCw className="size-4" /> Reload</Button>
          <Button as={Link} to="/" variant="secondary">Go to dashboard</Button>
        </div>
      </div>
    </div>
  );
}
