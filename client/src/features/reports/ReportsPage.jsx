import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { formatMoney } from '@webx/shared/money.js';
import { formatShortDate, fyLabel } from '@webx/shared/fy.js';
import { useReport, useSettings } from '@/api/hooks';
import { RangePicker, rangeParams } from '@/components/RangePicker';
import { CategoryBars, ChartOrTable, IncomeExpenseChart, Legend, SERIES } from '@/components/charts';
import { presetRange } from '@/lib/ranges';
import { cn } from '@/lib/cn';
import { Button, Card, CardHeader, PageHeader, QueryState, Select, Table, Td, Th } from '@/components/ui';

const TABS = [
  ['pnl', 'Profit & loss'],
  ['income', 'Income by client'],
  ['expenses', 'Expenses by category'],
  ['receivables', 'Receivables'],
  ['payouts', 'Payouts'],
  ['gst', 'GST'],
];

const fmt = (v, type) => (type === 'money' ? formatMoney(v ?? 0) : type === 'percent' ? `${((v ?? 0) * 100).toFixed(1)}%` : type === 'date' ? (v ? formatShortDate(v) : '—') : v ?? '');

function ReportTable({ columns, rows, total, empty = 'No data for this period.' }) {
  if (!rows.length) return <p className="px-5 py-10 text-center text-sm text-muted">{empty}</p>;
  const right = (c) => (['money', 'number', 'percent'].includes(c.type) ? 'right' : 'left');
  return (
    <Table>
      <thead><tr>{columns.map((c) => <Th key={c.key} align={right(c)}>{c.label}</Th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{columns.map((c) => <Td key={c.key} align={right(c)} className={c.bold ? 'font-semibold text-ink' : ''}>{c.render ? c.render(r) : fmt(r[c.key], c.type)}</Td>)}</tr>
        ))}
        {total && (
          <tr className="bg-lavender font-bold text-ink">{columns.map((c) => <Td key={c.key} align={right(c)}>{c.key in total ? fmt(total[c.key], c.type) : ''}</Td>)}</tr>
        )}
      </tbody>
    </Table>
  );
}

function ExportBar({ name, params }) {
  const url = (format) => `/api/reports/${name}?${new URLSearchParams(Object.entries({ ...params, format }).filter(([, v]) => v)).toString()}`;
  return (
    <div className="flex gap-1">
      <Button as="a" href={url('pdf')} variant="ghost" size="sm"><FileText className="size-3.5" /> PDF</Button>
      <Button as="a" href={url('csv')} variant="ghost" size="sm"><Download className="size-3.5" /> CSV</Button>
      <Button as="a" href={url('xlsx')} variant="ghost" size="sm"><FileSpreadsheet className="size-3.5" /> Excel</Button>
    </div>
  );
}

function Pnl({ fyStart }) {
  const current = fyLabel(new Date(), fyStart);
  const [fy, setFy] = useState(current);
  const monthly = useReport('pnl', { fy });
  const byFy = useReport('pnl-fy');
  const fys = [...new Set([current, ...(byFy.data?.rows.map((r) => r.fy) || [])])].sort().reverse();
  const cols = [
    { key: 'label', label: 'Month', type: 'text', bold: true },
    { key: 'income', label: 'Income', type: 'money' },
    { key: 'expenses', label: 'Expenses', type: 'money' },
    { key: 'net', label: 'Net profit', type: 'money', render: (r) => <span className={r.net < 0 ? 'text-red-600' : ''}>{formatMoney(r.net)}</span> },
  ];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Profit & loss by month"
          description="Cash basis: income is money received (plus TDS) and expenses are money paid out."
          actions={
            <>
              <Select value={fy} onChange={(e) => setFy(e.target.value)} className="w-32" aria-label="Financial year">{fys.map((f) => <option key={f} value={f}>FY {f}</option>)}</Select>
              <ExportBar name="pnl" params={{ fy }} />
            </>
          }
        />
        <QueryState query={monthly}>
          {(d) => (
            <>
              <div className="grid gap-4 border-b border-line/60 px-5 py-4 sm:grid-cols-3">
                <div><p className="text-xs text-muted">Income</p><p className="text-xl font-black tabular-nums">{formatMoney(d.totals.income)}</p></div>
                <div><p className="text-xs text-muted">Expenses</p><p className="text-xl font-black tabular-nums">{formatMoney(d.totals.expenses)}</p></div>
                <div><p className="text-xs text-muted">Net profit</p><p className={`text-xl font-black tabular-nums ${d.totals.net < 0 ? 'text-red-600' : 'text-brand-600'}`}>{formatMoney(d.totals.net)}</p></div>
              </div>
              <div className="px-3 pt-4">
                <div className="mb-2 px-2"><Legend items={[{ label: 'Income', color: SERIES.income }, { label: 'Expenses', color: SERIES.expenses }]} /></div>
                <IncomeExpenseChart months={d.months} height={240} />
              </div>
              <ReportTable columns={cols} rows={d.months} total={{ label: 'Total', ...d.totals }} />
            </>
          )}
        </QueryState>
      </Card>
      <Card>
        <CardHeader title="By financial year" actions={<ExportBar name="pnl-fy" params={{}} />} />
        <QueryState query={byFy}>{(d) => <ReportTable columns={[{ key: 'fy', label: 'Financial year', type: 'text', bold: true }, ...cols.slice(1)]} rows={d.rows} />}</QueryState>
      </Card>
    </div>
  );
}

function RangedReport({ name, title, description, fyStart, children }) {
  const [range, setRange] = useState(() => ({ preset: 'this_fy', ...presetRange('this_fy', fyStart) }));
  const params = rangeParams(range);
  const query = useReport(name, params);
  return (
    <Card>
      <CardHeader title={title} description={description} actions={<><RangePicker value={range} onChange={setRange} /><ExportBar name={name} params={params} /></>} />
      <QueryState query={query}>{(d) => children(d)}</QueryState>
    </Card>
  );
}

function Receivables() {
  const receivables = useReport('receivables', {});
  return (
        <Card>
          <CardHeader title="Receivables ageing" description="Unpaid balances by how long they are overdue (from the due date, or the invoice date when there is none)." actions={<ExportBar name="receivables" params={{}} />} />
          <QueryState query={receivables}>
            {(d) => (
              <>
                <div className="grid gap-px border-b border-line/60 bg-line/50 sm:grid-cols-6">
                  {[...d.buckets, { key: 'total', label: 'Total outstanding' }].map((b) => (
                    <div key={b.key} className="bg-white px-4 py-3">
                      <p className="text-xs text-muted">{b.label}</p>
                      <p className={`text-lg font-black tabular-nums ${b.key === 'd90plus' && d.totals[b.key] ? 'text-red-600' : 'text-ink'}`}>{formatMoney(d.totals[b.key])}</p>
                    </div>
                  ))}
                </div>
                <ReportTable
                  columns={[{ key: 'name', label: 'Client', type: 'text', bold: true, render: (r) => <Link to={`/clients/${r.client}`} className="hover:text-brand-600">{r.name}</Link> }, ...d.buckets.map((b) => ({ key: b.key, label: b.label, type: 'money' })), { key: 'total', label: 'Total', type: 'money' }]}
                  rows={d.rows}
                  total={{ name: 'Total', ...d.totals }}
                  empty="Nothing outstanding. Every invoice is paid."
                />
                {d.invoices.length > 0 && (
                  <div className="border-t border-line/60">
                    <p className="px-5 pt-4 pb-2 text-sm font-bold text-ink">Unpaid invoices</p>
                    <ReportTable
                      columns={[
                        { key: 'number', label: 'Invoice', type: 'text', render: (r) => <Link to={`/invoices/${r._id}`} className="font-mono text-brand-600 hover:underline">{r.number}</Link> },
                        { key: 'client', label: 'Client', type: 'text' },
                        { key: 'issueDate', label: 'Date', type: 'date' },
                        { key: 'dueDate', label: 'Due', type: 'date' },
                        { key: 'daysOverdue', label: 'Days overdue', type: 'number' },
                        { key: 'amount', label: 'Outstanding (₹)', type: 'money' },
                      ]}
                      rows={d.invoices}
                    />
                  </div>
                )}
              </>
            )}
          </QueryState>
        </Card>
  );
}

export function ReportsPage() {
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'pnl';
  const fyStart = settings.data?.fyStartMonth ?? 4;

  return (
    <>
      <PageHeader title="Reports" description="Profit, income, spending, what clients owe, payouts and GST. Every report exports to PDF, CSV and Excel." />
      <nav className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Reports">
        <div className="flex w-max gap-1 rounded-xl border border-line/70 bg-white p-1 shadow-xs">
          {TABS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setParams({ tab: k })} aria-current={tab === k ? 'page' : undefined}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap', tab === k ? 'bg-ink text-white' : 'text-muted hover:bg-panel hover:text-body')}>
              {l}
            </button>
          ))}
        </div>
      </nav>

      {tab === 'pnl' && <Pnl fyStart={fyStart} />}

      {tab === 'income' && (
        <RangedReport name="income-by-client" title="Income by client" description="Payments received (plus TDS) in the period." fyStart={fyStart}>
          {(d) => (
            <ReportTable
              columns={[
                { key: 'name', label: 'Client', type: 'text', bold: true, render: (r) => <Link to={`/clients/${r.client}`} className="hover:text-brand-600">{r.name}</Link> },
                { key: 'payments', label: 'Payments', type: 'number' },
                { key: 'received', label: 'Received', type: 'money' },
                { key: 'tds', label: 'TDS', type: 'money' },
                { key: 'total', label: 'Total', type: 'money' },
                { key: 'share', label: 'Share', type: 'percent' },
              ]}
              rows={d.rows}
              total={{ name: 'Total', total: d.total }}
            />
          )}
        </RangedReport>
      )}

      {tab === 'expenses' && (
        <RangedReport name="expense-by-category" title="Expenses by category" description="Expenses, reimbursements paid, and team payouts in the period." fyStart={fyStart}>
          {(d) =>
            d.rows.length ? (
              <>
                <div className="border-b border-line/60 px-3 py-4"><CategoryBars rows={d.rows} max={10} /></div>
                <ReportTable columns={[{ key: 'category', label: 'Category', type: 'text', bold: true }, { key: 'count', label: 'Entries', type: 'number' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'share', label: 'Share', type: 'percent' }]} rows={d.rows} total={{ category: 'Total', amount: d.total }} />
              </>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-muted">No spending in this period.</p>
            )
          }
        </RangedReport>
      )}

      {tab === 'receivables' && <Receivables />}

      {tab === 'payouts' && (
        <RangedReport name="payouts" title="Payout summary" description="What each team member was paid in the period." fyStart={fyStart}>
          {(d) => (
            <ReportTable
              columns={[
                { key: 'name', label: 'Team member', type: 'text', bold: true, render: (r) => <Link to={`/team/${r.member}`} className="hover:text-brand-600">{r.name}</Link> },
                { key: 'type', label: 'Type', type: 'text' },
                { key: 'count', label: 'Payouts', type: 'number' },
                { key: 'gross', label: 'Gross + bonus', type: 'money' },
                { key: 'deductions', label: 'Deductions', type: 'money' },
                { key: 'net', label: 'Net paid', type: 'money' },
              ]}
              rows={d.rows}
              total={{ name: 'Total', ...d.totals }}
            />
          )}
        </RangedReport>
      )}

      {tab === 'gst' && (
        <RangedReport name="gst" title="GST summary" description="Output GST on invoices issued in the period (by invoice date), converted to INR." fyStart={fyStart}>
          {(d) => (
            <>
              {!d.enabled && <p className="border-b border-line/60 bg-panel/50 px-5 py-2.5 text-xs text-muted">GST is currently off in Settings. Earlier GST invoices still show here.</p>}
              <ReportTable
                columns={[
                  { key: 'month', label: 'Month', type: 'text', bold: true },
                  { key: 'invoices', label: 'Invoices', type: 'number' },
                  { key: 'taxable', label: 'Taxable value', type: 'money' },
                  { key: 'cgst', label: 'CGST', type: 'money' },
                  { key: 'sgst', label: 'SGST', type: 'money' },
                  { key: 'igst', label: 'IGST', type: 'money' },
                  { key: 'total', label: 'Total GST', type: 'money' },
                ]}
                rows={d.rows}
                total={{ month: 'Total', ...d.totals }}
                empty="No GST invoices in this period."
              />
            </>
          )}
        </RangedReport>
      )}
    </>
  );
}
