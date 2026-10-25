import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package, Pencil, Plus, Search } from 'lucide-react';
import { formatMoney, fromMinor, toMinor } from '@webx/shared/money.js';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { useServices } from '@/api/hooks';
import { useDebounced } from '@/hooks/useDebounced';
import { moneyString } from '@/lib/validation';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, ModalFooter, MoneyInput, PageHeader, Pagination, QueryState, Select, Switch, Table, Td, Textarea, Th } from '@/components/ui';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(1000),
  rate: moneyString().refine((v) => v.trim() !== '', 'Enter a rate'),
  unit: z.string().trim().max(30),
  sac: z.string().trim().max(12),
  category: z.string().trim().max(60),
  isActive: z.boolean(),
});

function ServiceForm({ service, onDone, onCancel }) {
  const { register, handleSubmit, formState, setError, watch, setValue } = useForm({
    resolver: zodResolver(schema),
    defaultValues: service
      ? { name: service.name, description: service.description || '', rate: fromMinor(service.rate), unit: service.unit || '', sac: service.sac || '', category: service.category || '', isActive: service.isActive }
      : { name: '', description: '', rate: '', unit: 'project', sac: '998314', category: '', isActive: true },
  });
  const e = formState.errors;
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        try {
          const body = { ...v, rate: toMinor(v.rate) };
          const res = service ? await api.put(`/services/${service._id}`, body) : await api.post('/services', body);
          onDone(res.data.service);
        } catch (err) {
          if (!applyServerErrors(err, setError)) setError('name', { message: errorMessage(err) });
        }
      })}
      className="space-y-4"
      noValidate
    >
      <Field label="Service name" required error={e.name?.message} hint="Printed as the line item title.">
        <Input {...register('name')} placeholder="Website Design & Development" />
      </Field>
      <Field label="Description" error={e.description?.message} hint="Printed under the title on invoices and quotes.">
        <Textarea rows={2} {...register('description')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rate" required error={e.rate?.message}><MoneyInput {...register('rate')} /></Field>
        <Field label="Per" error={e.unit?.message}>
          <Select {...register('unit')}>
            {['project', 'page', 'month', 'year', 'hour', 'item', ''].map((u) => <option key={u} value={u}>{u || '(none)'}</option>)}
          </Select>
        </Field>
        <Field label="Category" error={e.category?.message}><Input {...register('category')} placeholder="Web, Design, Hosting…" /></Field>
        <Field label="SAC/HSN" error={e.sac?.message} hint="998314 = IT design & development."><Input {...register('sac')} /></Field>
      </div>
      {service && <Switch checked={watch('isActive')} onChange={(on) => setValue('isActive', on)} label="Active" description="Inactive services are hidden from the picker." />}
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={formState.isSubmitting}>{service ? 'Save' : 'Add service'}</Button>
      </ModalFooter>
    </form>
  );
}

export function ServicesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('1');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const q = useDebounced(search);
  const services = useServices({ page, limit: 50, search: q || undefined, active });

  return (
    <>
      <PageHeader title="Saved services" description="Your services and rates. Pick them on invoices and quotes instead of retyping." actions={<Button onClick={() => setEditing({})}><Plus className="size-4" /> Add service</Button>} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-line/60 px-5 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search services" className="pl-9" aria-label="Search services" />
          </div>
          <Select value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} className="w-32" aria-label="Show"><option value="1">Active</option><option value="0">Inactive</option><option value="all">All</option></Select>
        </div>
        <QueryState query={services}>
          {(d) =>
            d.items.length ? (
              <>
                <Table>
                  <thead><tr><Th>Service</Th><Th>Category</Th><Th>SAC</Th><Th align="right">Rate</Th><Th align="right"><span className="sr-only">Edit</span></Th></tr></thead>
                  <tbody>
                    {d.items.map((x) => (
                      <tr key={x._id} className={x.isActive ? '' : 'opacity-60'}>
                        <Td>
                          <p className="font-semibold text-ink">{x.name} {!x.isActive && <Badge tone="amber">Inactive</Badge>}</p>
                          {x.description && <p className="max-w-md truncate text-xs text-muted">{x.description}</p>}
                        </Td>
                        <Td className="text-muted">{x.category || '—'}</Td>
                        <Td className="font-mono text-xs text-muted">{x.sac || '—'}</Td>
                        <Td align="right" className="font-semibold whitespace-nowrap">{formatMoney(x.rate)}{x.unit && <span className="text-xs font-normal text-muted"> / {x.unit}</span>}</Td>
                        <Td align="right"><Button size="icon" variant="ghost" onClick={() => setEditing(x)} aria-label={`Edit ${x.name}`}><Pencil className="size-4" /></Button></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} />
              </>
            ) : (
              <EmptyState icon={Package} title={q ? 'No matches' : 'No saved services yet'} description="Add what you sell (website, landing page, logo, hosting, maintenance) with your usual rate." action={!q && <Button onClick={() => setEditing({})}><Plus className="size-4" /> Add service</Button>} />
            )
          }
        </QueryState>
      </Card>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?._id ? `Edit ${editing.name}` : 'Add service'} size="md">
        {editing && (
          <ServiceForm
            service={editing._id ? editing : null}
            onCancel={() => setEditing(null)}
            onDone={(svc) => { setEditing(null); qc.invalidateQueries({ queryKey: ['services'] }); toast.success(`${svc.name} saved`); }}
          />
        )}
      </Modal>
    </>
  );
}
