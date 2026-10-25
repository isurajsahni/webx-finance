import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, History, Search } from 'lucide-react';
import { useAuditLogs } from '@/api/hooks';
import { useDebounced } from '@/hooks/useDebounced';
import { Badge, Card, CardHeader, EmptyState, Input, Pagination, QueryState, Select, Table, Td, Th } from '@/components/ui';

const ACTION_TONE = { create: 'green', update: 'brand', void: 'red', handover: 'brand', archive: 'amber', unarchive: 'green', status: 'dark', login: 'neutral', login_failed: 'amber', password_change: 'dark', password_reset: 'dark', numbering_set: 'brand' };
const ENTITIES = ['Invoice', 'Quote', 'Payment', 'Client', 'Expense', 'Payout', 'TeamMember', 'Service', 'LedgerEntry', 'BankAccount', 'Settings', 'ExpenseCategory', 'User', 'Counter'];

const fmtValue = (v) => {
  if (v === null || v === undefined || v === '') return <span className="text-muted italic">empty</span>;
  if (typeof v === 'object') return <code className="text-[11px]">{JSON.stringify(v)}</code>;
  return String(v);
};

const fmtTime = (d) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function AuditTab() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const q = useDebounced(search);
  const logs = useAuditLogs({ page, limit: 25, entity: entity || undefined, search: q || undefined });

  return (
    <Card>
      <CardHeader title="Audit log" description="Every change to settings and financial records: who, what and when. This log cannot be edited." />
      <div className="flex flex-wrap gap-3 border-b border-line/60 px-5 py-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search person or action" className="pl-9" aria-label="Search audit log" />
        </div>
        <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} className="w-44" aria-label="Filter by record type">
          <option value="">All records</option>
          {ENTITIES.map((x) => <option key={x} value={x}>{x}</option>)}
        </Select>
      </div>
      <QueryState query={logs}>
        {(data) =>
          data.items.length ? (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th className="w-8"><span className="sr-only">Expand</span></Th>
                    <Th>When</Th>
                    <Th>Who</Th>
                    <Th>Action</Th>
                    <Th>Record</Th>
                    <Th align="right">Changes</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((l) => {
                    const expandable = l.changes?.length > 0;
                    const isOpen = open === l._id;
                    return (
                      <Fragment key={l._id}>
                        <tr className={expandable ? 'cursor-pointer hover:bg-panel/50' : ''} onClick={() => expandable && setOpen(isOpen ? null : l._id)}>
                          <Td className="text-muted">
                            {expandable && (isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />)}
                          </Td>
                          <Td className="whitespace-nowrap text-muted">{fmtTime(l.at)}</Td>
                          <Td className="font-semibold">{l.actorName || 'System'}</Td>
                          <Td><Badge tone={ACTION_TONE[l.action] || 'neutral'}>{l.action.replace(/_/g, ' ')}</Badge></Td>
                          <Td>{l.entity}{l.label && <span className="ml-1 font-mono text-xs text-muted">{l.label}</span>}</Td>
                          <Td align="right" className="text-muted">{l.changes?.length || '–'}</Td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={6} className="border-b border-line/50 bg-panel/40 px-12 py-3">
                              <table className="w-full text-xs">
                                <tbody>
                                  {l.changes.map((c) => (
                                    <tr key={c.path} className="align-top">
                                      <td className="py-1 pr-4 font-mono font-semibold whitespace-nowrap">{c.path}</td>
                                      <td className="py-1 pr-4 break-all text-red-700/80 line-through decoration-red-300">{fmtValue(c.from)}</td>
                                      <td className="py-1 break-all text-emerald-700">{fmtValue(c.to)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </Table>
              <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
            </>
          ) : (
            <EmptyState icon={History} title="Nothing logged yet" />
          )
        }
      </QueryState>
    </Card>
  );
}
