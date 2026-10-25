import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Eye, PencilLine } from 'lucide-react';
import { MONTHS, PAYMENT_MODES, PAYMENT_MODE_LABELS } from '@webx/shared/constants.js';
import { formatMoney, fromMinor, toMinor } from '@webx/shared/money.js';
import { todayISO } from '@webx/shared/fy.js';
import { renderPayslip, computePayout } from '@webx/shared/templates/index.js';
import { api, applyServerErrors, errorMessage } from '@/api/client';
import { useBankAccounts, useSettings, useTeam } from '@/api/hooks';
import { DocumentPreview } from '@/components/DocumentPreview';
import { LinesEditor } from '@/components/LinesEditor';
import { previewAssets } from '@/lib/documentAssets';
import { cn } from '@/lib/cn';
import { Button, Card, CardHeader, Field, Input, MoneyInput, QueryState, Select, Textarea } from '@/components/ui';

const moneyOk = (v) => v.trim() === '' || (toMinor(v) !== null && toMinor(v) >= 0);
const line = z.object({ label: z.string().trim().min(1, 'Add a label').max(120), amount: z.string().refine(moneyOk, 'Invalid amount') });
const schema = z
  .object({
    member: z.string().min(1, 'Choose who you are paying'),
    date: z.string().min(1, 'Pick a date'),
    periodLabel: z.string().trim().max(60),
    project: z.string().trim().max(120),
    earnings: z.array(line).min(1),
    bonus: z.string().refine(moneyOk, 'Invalid amount'),
    deductions: z.array(line),
    mode: z.enum(PAYMENT_MODES),
    reference: z.string().trim().max(80),
    paidFrom: z.string().min(1, 'Choose the account'),
    notes: z.string().trim().max(1000),
  })
  .superRefine((v, ctx) => {
    if (!v.periodLabel && !v.project) ctx.addIssue({ code: 'custom', path: ['periodLabel'], message: 'Add a period or a project' });
  });

/** "September 2026" for the month before today. */
function lastMonthLabel() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const toLines = (rows) => rows.filter((r) => r.label || r.amount).map((r) => ({ label: r.label, amount: toMinor(r.amount) || 0 }));

function Editor({ settings, members, accounts }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [showPreview, setShowPreview] = useState(false);
  const defaultAccount = accounts.find((a) => a.isDefault)?._id || accounts[0]?._id || '';

  const { register, control, handleSubmit, setValue, formState, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      member: params.get('member') || '',
      date: todayISO(),
      periodLabel: '',
      project: '',
      earnings: [{ label: '', amount: '' }],
      bonus: '',
      deductions: [],
      mode: 'bank_transfer',
      reference: '',
      paidFrom: defaultAccount,
      notes: '',
    },
  });
  const v = useWatch({ control });
  const e = formState.errors;
  const member = members.find((m) => m._id === v.member);

  // Picking a member pre-fills the usual pay.
  const [prefilled, setPrefilled] = useState(null);
  useEffect(() => {
    if (!member || prefilled === member._id) return;
    setPrefilled(member._id);
    if (member.payBasis === 'monthly') {
      setValue('periodLabel', lastMonthLabel());
      setValue('earnings', [{ label: 'Monthly salary', amount: member.monthlySalary ? fromMinor(member.monthlySalary) : '' }]);
    } else {
      setValue('periodLabel', '');
      setValue('earnings', [{ label: 'Project fee', amount: member.projectRate ? fromMinor(member.projectRate) : '' }]);
    }
    setValue('mode', member.payoutDetails?.method === 'upi' ? 'upi' : 'bank_transfer');
  }, [member, prefilled, setValue]);

  const doc = useMemo(
    () => ({
      voucherNumber: '',
      date: v.date,
      periodLabel: v.periodLabel,
      project: v.project,
      earnings: toLines(v.earnings || []),
      deductions: toLines(v.deductions || []),
      bonus: toMinor(v.bonus) || 0,
      mode: v.mode,
      reference: v.reference,
      notes: v.notes,
      snapshot: { company: settings.company, member: member ? { name: member.name, role: member.role, type: member.type, email: member.email, phone: member.phone, payoutDetails: member.payoutDetails } : {} },
    }),
    [v, member, settings],
  );
  const totals = computePayout(doc);
  const assets = useMemo(() => previewAssets(settings), [settings]);
  const html = useMemo(() => renderPayslip(doc, { settings, assets }), [doc, settings, assets]);

  const onSubmit = handleSubmit(
    async (f) => {
      if (totals.net <= 0) return setError('deductions', { message: 'Net pay must be more than 0' });
      try {
        const { data } = await api.post('/payouts', {
          member: f.member, date: f.date, periodLabel: f.periodLabel, project: f.project,
          earnings: toLines(f.earnings), deductions: toLines(f.deductions), bonus: toMinor(f.bonus) || 0,
          mode: f.mode, reference: f.reference, paidFrom: f.paidFrom, notes: f.notes,
        });
        ['payouts', 'team'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
        toast.success(`${data.payout.voucherNumber} · ${formatMoney(data.payout.net)} paid to ${member?.name}`);
        navigate(`/payouts/${data.payout._id}`);
      } catch (err) {
        if (!applyServerErrors(err, setError)) toast.error(errorMessage(err));
      }
    },
    () => toast.error('Fix the highlighted fields'),
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/team" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-body"><ArrowLeft className="size-3.5" /> Team & payouts</Link>
          <h1 className="text-2xl font-black tracking-tight text-ink">New payout</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="xl:hidden" onClick={() => setShowPreview((s) => !s)}>{showPreview ? <PencilLine className="size-4" /> : <Eye className="size-4" />} {showPreview ? 'Edit' : 'Preview'}</Button>
          <Button type="submit" loading={formState.isSubmitting}>Save payout · {formatMoney(Math.max(totals.net, 0))}</Button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <div className={cn('min-w-0 space-y-6', showPreview && 'hidden xl:block')}>
          <Card>
            <CardHeader title="Paid to" />
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
              <Field label="Team member" required error={e.member?.message} className="sm:col-span-2">
                <Select {...register('member')}>
                  <option value="">{members.length ? 'Choose team member' : 'Add a team member first'}</option>
                  {members.map((m) => <option key={m._id} value={m._id}>{m.name}{m.role ? ` · ${m.role}` : ''} ({m.type})</option>)}
                </Select>
              </Field>
              <Field label="Payment date" error={e.date?.message}><Input type="date" {...register('date')} /></Field>
              <Field label="Period" error={e.periodLabel?.message} hint="e.g. September 2026"><Input {...register('periodLabel')} /></Field>
              <Field label="Project" error={e.project?.message} hint="For per-project payouts." className="sm:col-span-2"><Input {...register('project')} /></Field>
            </div>
          </Card>
          <Card>
            <CardHeader title="Earnings and deductions" />
            <div className="space-y-5 px-5 py-5">
              <div>
                <p className="mb-1.5 text-[13px] font-semibold">Earnings</p>
                <LinesEditor control={control} register={register} errors={e} name="earnings" labelKey="label" labelPlaceholder="e.g. Monthly salary, Project fee" addLabel="Add earning" />
              </div>
              <Field label="Bonus" error={e.bonus?.message} className="sm:w-1/2"><MoneyInput {...register('bonus')} placeholder="0" /></Field>
              <div>
                <p className="mb-1.5 text-[13px] font-semibold">Deductions <span className="font-normal text-muted">(TDS, advance recovered…)</span></p>
                <LinesEditor control={control} register={register} errors={e} name="deductions" labelKey="label" labelPlaceholder="e.g. TDS @ 10%" addLabel="Add deduction" minRows={0} negative />
              </div>
              <dl className="grid grid-cols-3 gap-3 rounded-xl bg-panel px-4 py-3 text-sm">
                <div><dt className="text-xs text-muted">Gross + bonus</dt><dd className="font-bold tabular-nums">{formatMoney(totals.gross + totals.bonus)}</dd></div>
                <div><dt className="text-xs text-muted">Deductions</dt><dd className="font-bold tabular-nums">− {formatMoney(totals.totalDeductions)}</dd></div>
                <div><dt className="text-xs text-muted">Net paid</dt><dd className={`font-bold tabular-nums ${totals.net > 0 ? 'text-brand-600' : 'text-red-600'}`}>{formatMoney(totals.net)}</dd></div>
              </dl>
            </div>
          </Card>
          <Card>
            <CardHeader title="Payment" />
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-3">
              <Field label="Mode"><Select {...register('mode')}>{PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>)}</Select></Field>
              <Field label="Paid from" error={e.paidFrom?.message}>
                <Select {...register('paidFrom')}><option value="">Choose account</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.label}</option>)}</Select>
              </Field>
              <Field label="Reference" error={e.reference?.message}><Input {...register('reference')} placeholder="UTR / txn ID" /></Field>
              <Field label="Note on payslip" error={e.notes?.message} className="sm:col-span-3"><Textarea rows={2} {...register('notes')} /></Field>
            </div>
          </Card>
        </div>
        <div className={cn('min-w-0 xl:sticky xl:top-6', !showPreview && 'hidden xl:block')}>
          <div className="mb-2 flex items-center justify-between text-xs text-muted"><span className="font-bold tracking-wider uppercase">Live preview</span><span>Number assigned on save</span></div>
          <DocumentPreview html={html} />
        </div>
      </div>
    </form>
  );
}

export function PayoutEditorPage() {
  const settings = useSettings();
  const team = useTeam({ limit: 200, active: '1' });
  const accounts = useBankAccounts();
  return (
    <QueryState query={settings}>
      {(s) => <QueryState query={team}>{(t) => <QueryState query={accounts}>{(a) => <Editor settings={s} members={t.items} accounts={a} />}</QueryState>}</QueryState>}
    </QueryState>
  );
}
