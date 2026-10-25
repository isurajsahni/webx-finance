import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Check, Copy, Download, ExternalLink, FileText, Pencil, Send, X } from 'lucide-react';
import { formatMoney } from '@webx/shared/money.js';
import { formatLongDate } from '@webx/shared/fy.js';
import { renderInvoice } from '@webx/shared/templates/index.js';
import { api } from '@/api/client';
import { useApiMutation, useQuote, useSettings } from '@/api/hooks';
import { DocumentPreview } from '@/components/DocumentPreview';
import { previewAssets } from '@/lib/documentAssets';
import { Button, Card, CardHeader, Field, Modal, ModalFooter, QueryState, Textarea } from '@/components/ui';
import { QuoteStatusBadge } from './QuoteStatusBadge';

function View({ quote, settings }) {
  const navigate = useNavigate();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const assets = useMemo(() => previewAssets(settings), [settings]);
  const html = useMemo(() => renderInvoice({ ...quote, docType: 'quote' }, { settings, assets }), [quote, settings, assets]);
  const opts = { invalidate: [['quotes'], ['invoices']] };
  const send = useApiMutation(() => api.post(`/quotes/${quote._id}/send`), { ...opts, success: (r) => `Quote ${r.data.quote.number} marked as sent` });
  const accept = useApiMutation(() => api.post(`/quotes/${quote._id}/accept`), { ...opts, success: 'Quote accepted' });
  const decline = useApiMutation(() => api.post(`/quotes/${quote._id}/decline`, { reason }), { ...opts, success: 'Quote marked as declined', onSuccess: () => setDeclining(false) });
  const convert = useApiMutation(() => api.post(`/quotes/${quote._id}/convert`), {
    ...opts,
    success: 'Invoice created from the quote. Review it and mark it sent.',
    onSuccess: (r) => navigate(`/invoices/${r.data.invoice._id}/edit`),
  });
  const dup = useApiMutation(() => api.post(`/quotes/${quote._id}/duplicate`), { ...opts, success: 'Copied into a new draft quote', onSuccess: (r) => navigate(`/quotes/${r.data.quote._id}/edit`) });
  const pdfUrl = `/api/quotes/${quote._id}/pdf`;
  const editable = ['draft', 'sent'].includes(quote.status);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/quotes" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-body"><ArrowLeft className="size-3.5" /> Quotes</Link>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-black tracking-tight text-ink">
            {quote.number ? <span className="font-mono">{quote.number}</span> : 'Draft quote'} <QuoteStatusBadge status={quote.displayStatus} />
          </h1>
          <p className="mt-1 text-sm text-muted">
            <Link to={`/clients/${quote.client}`} className="font-semibold text-body hover:text-brand-600">{quote.snapshot.client.name}</Link> · {formatLongDate(quote.issueDate)} · valid until {formatLongDate(quote.validUntil)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button as="a" href={`${pdfUrl}?download=1`}><Download className="size-4" /> Download PDF</Button>
          <Button as="a" href={pdfUrl} target="_blank" rel="noreferrer" variant="secondary"><ExternalLink className="size-4" /> Open PDF</Button>
          {editable && <Button as={Link} to={`/quotes/${quote._id}/edit`} variant="secondary"><Pencil className="size-4" /> Edit</Button>}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <DocumentPreview html={html} debounce={0} />
        <div className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardHeader title="Summary" />
            <dl className="space-y-2 px-5 py-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Total</dt><dd className="font-bold tabular-nums">{formatMoney(quote.total, quote.currency)}</dd></div>
              {quote.split?.type === 'advance' && <div className="flex justify-between"><dt className="text-muted">Advance on acceptance</dt><dd className="tabular-nums">{formatMoney(quote.split.advanceAmount, quote.currency)}</dd></div>}
              {quote.handover?.enabled && (
                <div className="flex justify-between gap-3"><dt className="text-muted">Hosting / maintenance</dt><dd className="text-right">{[quote.handover.hostingMonths && `${quote.handover.hostingMonths / 12}y hosting`, quote.handover.maintenanceMonths && `${quote.handover.maintenanceMonths}m maintenance`].filter(Boolean).join(' · ') || '—'}</dd></div>
              )}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Actions" />
            <div className="grid gap-2 p-4">
              {quote.status === 'converted' ? (
                <Button as={Link} to={`/invoices/${quote.invoice}`} variant="dark"><FileText className="size-4" /> Open invoice {quote.invoiceNumber || '(draft)'}</Button>
              ) : quote.status !== 'declined' ? (
                <>
                  <Button onClick={() => convert.mutate()} loading={convert.isPending}><FileText className="size-4" /> Convert to invoice</Button>
                  {quote.status === 'draft' && <Button variant="dark" onClick={() => send.mutate()} loading={send.isPending}><Send className="size-4" /> Finalise & mark sent</Button>}
                  {['draft', 'sent'].includes(quote.status) && <Button variant="secondary" onClick={() => accept.mutate()} loading={accept.isPending}><Check className="size-4" /> Mark accepted</Button>}
                  <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setDeclining(true)}><X className="size-4" /> Mark declined</Button>
                </>
              ) : (
                <p className="text-xs text-muted">Declined{quote.declineReason ? `: ${quote.declineReason}` : ''}.</p>
              )}
              <Button variant="secondary" onClick={() => dup.mutate()} loading={dup.isPending}><Copy className="size-4" /> Duplicate as new version</Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={declining} onClose={() => setDeclining(false)} title="Mark quote as declined?" size="sm">
        {declining && (
          <div>
            <Field label="Reason (optional)"><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setDeclining(false)}>Back</Button>
              <Button variant="danger" onClick={() => decline.mutate()} loading={decline.isPending}>Mark declined</Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </>
  );
}

export function QuoteViewPage() {
  const { id } = useParams();
  const quote = useQuote(id);
  const settings = useSettings();
  return <QueryState query={settings}>{(s) => <QueryState query={quote}>{(q) => <View quote={q} settings={s} />}</QueryState>}</QueryState>;
}
