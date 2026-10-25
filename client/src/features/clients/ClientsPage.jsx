import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Search, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney } from '@webx/shared/money.js';
import { formatShortDate } from '@webx/shared/fy.js';
import { useClients } from '@/api/hooks';
import { useDebounced } from '@/hooks/useDebounced';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Pagination, QueryState, Select, Table, Td, Th } from '@/components/ui';
import { ClientForm } from './ClientForm';

export function ClientsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState('0');
  const [adding, setAdding] = useState(false);
  const q = useDebounced(search);
  const clients = useClients({ page, limit: 25, search: q || undefined, archived });

  return (
    <>
      <PageHeader
        title="Clients"
        description="Everyone you bill, with what they owe."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" /> New client
          </Button>
        }
      />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-line/60 px-5 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, email, GSTIN" className="pl-9" aria-label="Search clients" />
          </div>
          <Select value={archived} onChange={(e) => { setArchived(e.target.value); setPage(1); }} className="w-40" aria-label="Show">
            <option value="0">Active</option>
            <option value="1">Archived</option>
            <option value="all">All</option>
          </Select>
        </div>
        <QueryState query={clients}>
          {(data) =>
            data.items.length ? (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Client</Th>
                      <Th>Contact</Th>
                      <Th align="right">Invoices</Th>
                      <Th align="right">Billed</Th>
                      <Th align="right">Outstanding</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((c) => (
                      <tr key={c._id} className="cursor-pointer hover:bg-panel/50" onClick={() => navigate(`/clients/${c._id}`)}>
                        <Td>
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-line/70 bg-panel text-xs font-black text-muted">
                              {c.logo ? <img src={`/api/files/${c.logo.key}`} alt="" className="max-h-full max-w-full object-contain p-0.5" /> : c.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-semibold text-ink">{c.name} {c.isArchived && <Badge tone="amber">Archived</Badge>}</span>
                              {(c.secondaryName || c.city) && <span className="block truncate text-xs text-muted">{[c.secondaryName, c.city].filter(Boolean).join(' · ')}</span>}
                            </span>
                          </div>
                        </Td>
                        <Td className="text-muted">
                          <p>{c.email || c.phone || '—'}</p>
                          {c.stats.lastInvoiceAt && <p className="text-xs">Last invoice {formatShortDate(c.stats.lastInvoiceAt)}</p>}
                        </Td>
                        <Td align="right">{c.stats.invoiceCount}</Td>
                        <Td align="right">{formatMoney(c.stats.billedInr)}</Td>
                        <Td align="right" className={c.stats.outstandingInr > 0 ? 'font-bold text-ink' : 'text-muted'}>
                          {formatMoney(c.stats.outstandingInr)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
              </>
            ) : (
              <EmptyState
                icon={Users}
                title={q ? 'No matching clients' : 'No clients yet'}
                description={q ? 'Try a different search.' : 'Add your first client, or create one straight from a new invoice.'}
                action={!q && <Button onClick={() => setAdding(true)}><Plus className="size-4" /> New client</Button>}
              />
            )
          }
        </QueryState>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="New client" size="lg">
        {adding && (
          <ClientForm
            onCancel={() => setAdding(false)}
            onDone={(client) => {
              setAdding(false);
              qc.invalidateQueries({ queryKey: ['clients'] });
              toast.success(`${client.name} added`);
              navigate(`/clients/${client._id}`);
            }}
          />
        )}
      </Modal>
    </>
  );
}
