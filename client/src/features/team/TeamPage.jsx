import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, UsersRound } from 'lucide-react';
import { formatMoney } from '@webx/shared/money.js';
import { formatShortDate } from '@webx/shared/fy.js';
import { usePayouts, useTeam } from '@/api/hooks';
import { useDebounced } from '@/hooks/useDebounced';
import { cn } from '@/lib/cn';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Pagination, QueryState, Select, Table, Td, Th } from '@/components/ui';
import { MemberForm } from './MemberForm';
import { PayoutsTable } from './PayoutsTable';

function Members() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('1');
  const [adding, setAdding] = useState(false);
  const q = useDebounced(search);
  const team = useTeam({ page, limit: 25, search: q || undefined, active });

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-line/60 px-5 py-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Name, role, code, mobile" className="pl-9" aria-label="Search team" />
        </div>
        <Select value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} className="w-32" aria-label="Show"><option value="1">Current</option><option value="0">Left</option><option value="all">All</option></Select>
        <Button size="sm" className="ml-auto" onClick={() => setAdding(true)}><Plus className="size-4" /> Add member</Button>
      </div>
      <QueryState query={team}>
        {(data) =>
          data.items.length ? (
            <>
              <Table>
                <thead><tr><Th>Name</Th><Th>Mobile</Th><Th>Type</Th><Th>Pay</Th><Th>Last paid</Th><Th align="right">Paid to date</Th></tr></thead>
                <tbody>
                  {data.items.map((m) => (
                    <tr key={m._id} className="cursor-pointer hover:bg-panel/50" onClick={() => navigate(`/team/${m._id}`)}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-lavender text-xs font-black text-brand-600">
                            {m.photo ? <img src={`/api/files/${m.photo.key}`} alt="" className="size-full object-cover" /> : m.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink">
                              {m.name} {m.status === 'on_notice' ? <Badge tone="amber">On notice</Badge> : !m.isActive && <Badge tone="neutral">Left</Badge>}
                            </span>
                            <span className="block truncate text-xs text-muted">{[m.employeeCode, m.role, m.department].filter(Boolean).join(' · ')}</span>
                          </span>
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-muted">{m.phone || '—'}</Td>
                      <Td><Badge tone={m.type === 'employee' ? 'brand' : 'neutral'}>{m.type}</Badge></Td>
                      <Td className="text-muted">{m.payBasis === 'monthly' ? `${formatMoney(m.monthlySalary)}/month` : m.projectRate ? `${formatMoney(m.projectRate)}/project` : 'Per project'}</Td>
                      <Td className="text-muted">{m.stats.lastPaidAt ? formatShortDate(m.stats.lastPaidAt) : '—'}</Td>
                      <Td align="right" className="font-semibold text-ink">{formatMoney(m.stats.totalNet)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
            </>
          ) : (
            <EmptyState icon={UsersRound} title={q ? 'No matches' : 'No team members yet'} description="Add employees and freelancers you pay." action={!q && <Button onClick={() => setAdding(true)}><Plus className="size-4" /> Add member</Button>} />
          )
        }
      </QueryState>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add team member" size="lg">
        {adding && <MemberForm onCancel={() => setAdding(false)} onDone={(m) => { setAdding(false); qc.invalidateQueries({ queryKey: ['team'] }); toast.success(`${m.name} added`); navigate(`/team/${m._id}`); }} />}
      </Modal>
    </Card>
  );
}

function Payouts() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = useDebounced(search);
  const payouts = usePayouts({ page, limit: 25, search: q || undefined, from: from || undefined, to: to || undefined, status: '' });
  const s = payouts.data?.summary;
  return (
    <>
      {s && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="card px-5 py-4"><p className="text-xs font-semibold text-muted">Net paid{from || to ? ' (filtered)' : ''}</p><p className="mt-1 text-xl font-black text-ink tabular-nums">{formatMoney(s.net)}</p></div>
          <div className="card px-5 py-4"><p className="text-xs font-semibold text-muted">Deductions (TDS etc.)</p><p className="mt-1 text-xl font-black text-ink tabular-nums">{formatMoney(s.deductions)}</p></div>
          <div className="card px-5 py-4"><p className="text-xs font-semibold text-muted">Payouts</p><p className="mt-1 text-xl font-black text-ink tabular-nums">{s.count}</p></div>
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line/60 px-5 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Name, voucher, period" className="pl-9" aria-label="Search payouts" />
          </div>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" aria-label="From date" />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" aria-label="To date" />
          <Button as={Link} to="/payouts/new" size="sm" className="ml-auto"><Plus className="size-4" /> New payout</Button>
        </div>
        <PayoutsTable query={payouts} onPage={setPage} />
      </Card>
    </>
  );
}

export function TeamPage() {
  const [tab, setTab] = useState('members');
  return (
    <>
      <PageHeader title="Team & payouts" description="Employees and freelancers, with payslips and payment vouchers." actions={<Button as={Link} to="/payouts/new"><Plus className="size-4" /> New payout</Button>} />
      <div className="mb-4 inline-flex rounded-xl border border-line/70 bg-white p-1 shadow-xs" role="tablist">
        {[['members', 'Members'], ['payouts', 'Payouts']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('rounded-lg px-4 py-1.5 text-sm font-semibold', tab === k ? 'bg-ink text-white' : 'text-muted hover:bg-panel')}>{label}</button>
        ))}
      </div>
      {tab === 'members' ? <Members /> : <Payouts />}
    </>
  );
}
