import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Archive, ArchiveRestore, FileText, Globe, ImageIcon, Mail, MapPin, Pencil, Phone, Plus, Upload } from 'lucide-react';
import { placeOfSupply } from '@webx/shared/india.js';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney } from '@webx/shared/money.js';
import { api } from '@/api/client';
import { useApiMutation, useClient, useInvoices, usePayments } from '@/api/hooks';
import { PaymentsTable } from '@/features/payments/PaymentsTable';
import { useAuth } from '@/features/auth/AuthContext';
import { Badge, Button, Card, CardHeader, EmptyState, Modal, QueryState } from '@/components/ui';
import { InvoicesTable } from '@/features/invoices/InvoicesTable';
import { ClientForm } from './ClientForm';
import { StatementCard } from './StatementCard';

function Stat({ label, value, strong }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`mt-1 text-xl font-black tabular-nums ${strong ? 'text-brand-600' : 'text-ink'}`}>{value}</p>
    </div>
  );
}

function ClientLogoCard({ client }) {
  const input = useRef(null);
  const opts = { invalidate: [['clients']] };
  const upload = useApiMutation(
    (file) => {
      const fd = new FormData();
      fd.append('logo', file);
      return api.post(`/clients/${client._id}/logo`, fd);
    },
    { ...opts, success: 'Client logo saved. It appears on new and edited invoices.' },
  );
  const remove = useApiMutation(() => api.delete(`/clients/${client._id}/logo`), { ...opts, success: 'Client logo removed' });
  return (
    <Card>
      <CardHeader title="Client logo" description="Printed in BILLED TO on invoices and receipts." />
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="grid h-16 w-28 shrink-0 place-items-center rounded-lg border border-dashed border-line bg-panel p-2">
          {client.logo ? <img src={`/api/files/${client.logo.key}`} alt={`${client.name} logo`} className="max-h-full max-w-full object-contain" /> : <ImageIcon className="size-5 text-muted" aria-hidden />}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={input}
            type="file"
            accept="image/svg+xml,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = '';
            }}
          />
          <Button size="sm" variant="secondary" onClick={() => input.current?.click()} loading={upload.isPending}><Upload className="size-3.5" /> {client.logo ? 'Replace' : 'Upload'}</Button>
          {client.logo && <Button size="sm" variant="ghost" onClick={() => remove.mutate()} loading={remove.isPending}>Remove</Button>}
        </div>
      </div>
    </Card>
  );
}

function ClientBody({ client }) {
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState(1);
  const invoices = useInvoices({ client: client._id, page, limit: 20 });
  const [payPage, setPayPage] = useState(1);
  const payments = usePayments({ client: client._id, page: payPage, limit: 20, status: '' });
  const archive = useApiMutation(() => api.post(`/clients/${client._id}/${client.isArchived ? 'unarchive' : 'archive'}`), {
    invalidate: [['clients']],
    success: client.isArchived ? 'Client restored' : 'Client archived',
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/clients" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-body">
            <ArrowLeft className="size-3.5" /> Clients
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-ink">
            {client.name} {client.isArchived && <Badge tone="amber">Archived</Badge>}
          </h1>
          {client.secondaryName && <p className="text-sm text-muted">{client.secondaryName}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner && (
            <Button variant="ghost" onClick={() => archive.mutate()} loading={archive.isPending}>
              {client.isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              {client.isArchived ? 'Restore' : 'Archive'}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
          <Button as={Link} to={`/invoices/new?client=${client._id}`}><Plus className="size-4" /> New invoice</Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Billed" value={formatMoney(client.stats.billedInr)} />
        <Stat label="Received" value={formatMoney(client.stats.receivedInr + client.stats.tdsInr)} />
        <Stat label="Outstanding" value={formatMoney(client.stats.outstandingInr)} strong={client.stats.outstandingInr > 0} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-6">
        <ClientLogoCard client={client} />
        <Card>
          <CardHeader title="Details" />
          <dl className="space-y-3 px-5 py-4 text-sm">
            {client.contactPerson && <div><dt className="text-xs text-muted">Contact</dt><dd className="font-semibold">{client.contactPerson}</dd></div>}
            {client.email && <div className="flex items-center gap-2"><Mail className="size-4 text-muted" /><a href={`mailto:${client.email}`} className="truncate text-brand-600 hover:underline">{client.email}</a></div>}
            {client.phone && <div className="flex items-center gap-2"><Phone className="size-4 text-muted" />{client.phone}</div>}
            {(client.address || client.city || client.state) && (
              <div className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
                <span className="whitespace-pre-line">
                  {[client.address, [client.city, [client.state, client.pincode].filter(Boolean).join(' ')].filter(Boolean).join(', '), client.country].filter(Boolean).join('\n')}
                </span>
              </div>
            )}
            {client.website && <div className="flex items-center gap-2"><Globe className="size-4 text-muted" /><span className="truncate">{client.website}</span></div>}
            {client.gstin && <div><dt className="text-xs text-muted">GSTIN</dt><dd className="font-mono">{client.gstin}</dd></div>}
            {client.pan && <div><dt className="text-xs text-muted">PAN</dt><dd className="font-mono">{client.pan}</dd></div>}
            {client.state && <div><dt className="text-xs text-muted">Place of supply</dt><dd>{placeOfSupply(client)}</dd></div>}
            <div><dt className="text-xs text-muted">Default currency</dt><dd>{client.defaultCurrency}</dd></div>
            {client.notes && <div><dt className="text-xs text-muted">Notes</dt><dd className="whitespace-pre-line">{client.notes}</dd></div>}
          </dl>
        </Card>
        </div>
        <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader title="Invoices" />
          <InvoicesTable
            query={invoices}
            onPage={setPage}
            showClient={false}
            empty={
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                action={<Button as={Link} to={`/invoices/new?client=${client._id}`} size="sm"><Plus className="size-4" /> New invoice</Button>}
              />
            }
          />
        </Card>
        <StatementCard client={client} />
        <Card>
          <CardHeader title="Payments" />
          <PaymentsTable query={payments} onPage={setPayPage} showClient={false} empty={<p className="px-5 py-6 text-sm text-muted">No payments yet.</p>} />
        </Card>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${client.name}`} size="lg">
        {editing && (
          <ClientForm
            client={client}
            onCancel={() => setEditing(false)}
            onDone={() => {
              setEditing(false);
              qc.invalidateQueries({ queryKey: ['clients'] });
              toast.success('Client saved');
            }}
          />
        )}
      </Modal>
    </>
  );
}

export function ClientDetailPage() {
  const { id } = useParams();
  const client = useClient(id);
  return <QueryState query={client}>{(c) => <ClientBody client={c} />}</QueryState>;
}
