// Charts follow the dataviz rules: thin bars (≤24px) with 4px rounded ends,
// hairline recessive grid, one axis, legend for 2+ series, tooltips on hover,
// and a table view so nothing depends on colour alone.
// Palette (validated: lightness, chroma, CVD ΔE 34, contrast ≥3:1 on white):
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@webx/shared/money.js';
import { cn } from '@/lib/cn';

export const SERIES = { income: '#9333EA', expenses: '#D97706' };
const GRID = '#ECEAF3';
const AXIS = '#6B7280';

/** ₹1.2L / ₹45K style ticks for INR (minor units in, labels out). */
export function shortInr(minor) {
  const v = Math.abs(minor) / 100;
  const sign = minor < 0 ? '-' : '';
  if (v >= 1e7) return `${sign}₹${+(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${sign}₹${+(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${sign}₹${+(v / 1e3).toFixed(0)}K`;
  return `${sign}₹${v.toFixed(0)}`;
}

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-ink">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-4 text-body">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}</span>
          <span className="font-semibold tabular-nums">{formatMoney(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: i.color }} />{i.label}</span>
      ))}
    </div>
  );
}

/** Toggle between a chart and its data table. */
export function ChartOrTable({ chart, table }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <div className="inline-flex rounded-md border border-line p-0.5 text-[11px] font-semibold" role="radiogroup" aria-label="View">
          {['Chart', 'Table'].map((l, i) => (
            <button key={l} type="button" role="radio" aria-checked={asTable === !!i} onClick={() => setAsTable(!!i)} className={cn('rounded px-2 py-0.5', asTable === !!i ? 'bg-ink text-white' : 'text-muted hover:text-body')}>{l}</button>
          ))}
        </div>
      </div>
      {asTable ? table : chart}
    </div>
  );
}

export function IncomeExpenseChart({ months, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={months} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={2} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 11 }} interval={0} />
        <YAxis tickFormatter={shortInr} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} width={56} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: '#F3F2F9' }} />
        <Bar dataKey="income" name="Income" fill={SERIES.income} radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Bar dataKey="expenses" name="Expenses" fill={SERIES.expenses} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars, one series, value at the tip. Folds the tail into "Other". */
export function CategoryBars({ rows, max = 7 }) {
  const top = rows.slice(0, max);
  const rest = rows.slice(max);
  const data = rest.length ? [...top, { category: `Other (${rest.length})`, amount: rest.reduce((s, r) => s + r.amount, 0) }] : top;
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34 + 12)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="category" width={150} tickLine={false} axisLine={false} tick={{ fill: '#1F2937', fontSize: 12 }} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: '#F3F2F9' }} />
        <Bar dataKey="amount" name="Spent" fill={SERIES.income} radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList dataKey="amount" position="right" formatter={(v) => formatMoney(v)} style={{ fill: '#6B7280', fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
