import { useState } from 'react';
import { Link } from 'react-router';
import { FileCheck2, FileText, Plus, Search } from 'lucide-react';
import { useInvoices } from '@/api/hooks';
import { useDebounced } from '@/hooks/useDebounced';
import { cn } from '@/lib/cn';
import { Button, Card, EmptyState, Input, PageHeader } from '@/components/ui';
import { InvoicesTable } from './InvoicesTable';

const TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function InvoicesPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const invoices = useInvoices({ page, limit: 25, status: status || undefined, search: q || undefined });

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Create, send and track client invoices."
        actions={
          <>
            <Button variant="secondary" as={Link} to="/invoices/new?paid=1"><FileCheck2 className="size-4" /> Already paid</Button>
            <Button as={Link} to="/invoices/new"><Plus className="size-4" /> New invoice</Button>
          </>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 px-5 py-3">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.value}
                role="tab"
                aria-selected={status === t.value}
                onClick={() => { setStatus(t.value); setPage(1); }}
                className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap', status === t.value ? 'bg-ink text-white' : 'text-muted hover:bg-panel hover:text-body')}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Number, client or item" className="pl-9" aria-label="Search invoices" />
          </div>
        </div>
        <InvoicesTable
          query={invoices}
          onPage={setPage}
          empty={
            <EmptyState
              icon={FileText}
              title={q || status ? 'No matching invoices' : 'No invoices yet'}
              description={q || status ? 'Try another filter or search.' : 'Create your first invoice. The PDF is generated in your template.'}
              action={!q && !status && <Button as={Link} to="/invoices/new"><Plus className="size-4" /> New invoice</Button>}
            />
          }
        />
      </Card>
    </>
  );
}
