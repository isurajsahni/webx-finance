import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Ban, Download, ExternalLink } from 'lucide-react';
import { PAYMENT_MODE_LABELS } from '@webx/shared/constants.js';
import { formatMoney } from '@webx/shared/money.js';
import { formatLongDate } from '@webx/shared/fy.js';
import { renderPayslip } from '@webx/shared/templates/index.js';
import { usePayout, useSettings } from '@/api/hooks';
import { useAuth } from '@/features/auth/AuthContext';
import { DocumentPreview } from '@/components/DocumentPreview';
import { previewAssets } from '@/lib/documentAssets';
import { Badge, Button, Card, CardHeader, Modal, QueryState } from '@/components/ui';
import { ReasonForm } from '@/features/expenses/ReasonForm';

function View({ payout, settings }) {
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const [voiding, setVoiding] = useState(false);
  const assets = useMemo(() => previewAssets(settings), [settings]);
  const html = useMemo(() => renderPayslip(payout, { settings, assets }), [payout, settings, assets]);
  const url = `/api/payouts/${payout._id}/payslip`;
  const m = payout.snapshot.member;
  const isVoid = payout.status === 'void';

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/team" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-body"><ArrowLeft className="size-3.5" /> Team & payouts</Link>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-black tracking-tight text-ink">
            <span className="font-mono">{payout.voucherNumber}</span> {isVoid ? <Badge tone="red">Void</Badge> : <Badge tone="green">Paid</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted"><Link to={`/team/${payout.member}`} className="font-semibold text-body hover:text-brand-600">{m.name}</Link> · {[payout.periodLabel, payout.project].filter(Boolean).join(' · ')} · {formatLongDate(payout.date)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button as="a" href={`${url}?download=1`}><Download className="size-4" /> Download {m.type === 'freelancer' ? 'voucher' : 'payslip'}</Button>
          <Button as="a" href={url} target="_blank" rel="noreferrer" variant="secondary"><ExternalLink className="size-4" /> Open PDF</Button>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <DocumentPreview html={html} debounce={0} />
        <div className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardHeader title="Summary" />
            <dl className="space-y-2 px-5 py-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Gross</dt><dd className="tabular-nums">{formatMoney(payout.gross)}</dd></div>
              {payout.bonus > 0 && <div className="flex justify-between"><dt className="text-muted">Bonus</dt><dd className="tabular-nums">{formatMoney(payout.bonus)}</dd></div>}
              {payout.totalDeductions > 0 && <div className="flex justify-between"><dt className="text-muted">Deductions</dt><dd className="tabular-nums">− {formatMoney(payout.totalDeductions)}</dd></div>}
              <div className="flex justify-between border-t border-line/60 pt-2"><dt className="font-semibold">Net paid</dt><dd className="font-bold tabular-nums">{formatMoney(payout.net)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Mode</dt><dd>{PAYMENT_MODE_LABELS[payout.mode]}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">From</dt><dd>{payout.paidFrom?.label}</dd></div>
            </dl>
          </Card>
          {isVoid ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">Voided: {payout.voidReason}</p>
          ) : (
            isOwner && <Button variant="ghost" className="w-full text-red-600 hover:bg-red-50" onClick={() => setVoiding(true)}><Ban className="size-4" /> Void payout</Button>
          )}
        </div>
      </div>
      <Modal open={voiding} onClose={() => setVoiding(false)} title={`Void ${payout.voucherNumber}?`} size="sm">
        {voiding && (
          <ReasonForm
            url={`/payouts/${payout._id}/void`}
            intro="The payout stays on file marked Void and is left out of totals. To correct it, void it and create a new payout."
            confirmLabel="Void payout"
            onCancel={() => setVoiding(false)}
            onDone={() => { setVoiding(false); ['payouts', 'team'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast.success('Payout voided'); }}
          />
        )}
      </Modal>
    </>
  );
}

export function PayoutViewPage() {
  const { id } = useParams();
  const payout = usePayout(id);
  const settings = useSettings();
  return <QueryState query={settings}>{(s) => <QueryState query={payout}>{(p) => <View payout={p} settings={s} />}</QueryState>}</QueryState>;
}
