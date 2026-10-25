import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export function Table({ className, children }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-left text-sm', className)}>{children}</table>
    </div>
  );
}

export function Th({ className, align = 'left', children }) {
  return (
    <th className={cn('border-b border-line/70 bg-panel/60 px-4 py-2.5 text-[11px] font-bold tracking-wider text-muted uppercase', align === 'right' && 'text-right', className)}>
      {children}
    </th>
  );
}

export function Td({ className, align = 'left', children, ...props }) {
  return (
    <td className={cn('border-b border-line/50 px-4 py-3 align-middle', align === 'right' && 'text-right tabular-nums', className)} {...props}>
      {children}
    </td>
  );
}

export function Pagination({ page, pages, total, onPage }) {
  if (!total) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 text-xs text-muted">
      <span>
        {total} {total === 1 ? 'record' : 'records'}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button variant="secondary" size="icon" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
