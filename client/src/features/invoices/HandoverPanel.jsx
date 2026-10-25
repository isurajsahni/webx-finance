import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { CalendarCheck, ServerCog, Wrench } from 'lucide-react';
import { HOSTING_PERIODS, MAINTENANCE_PERIODS, handoverSummary, periodLabel } from '@webx/shared/handover.js';
import { formatLongDate, todayISO, toDateInput } from '@webx/shared/fy.js';
import { api, errorMessage } from '@/api/client';
import { useApiMutation } from '@/api/hooks';
import { Button, Card, CardHeader, Field, Input, Modal, ModalFooter, Select, Switch } from '@/components/ui';

/** Handover terms on a saved invoice; editable even after it is paid. */
export function HandoverPanel({ invoice }) {
  const [open, setOpen] = useState(false);
  const h = invoice.handover || {};
  const { start, hostingEnd, maintenanceEnd } = handoverSummary(h);
  const waiting = h.startDate ? `starts ${formatLongDate(h.startDate)}` : 'starts on handover';
  const today = new Date();

  const save = useApiMutation((body) => api.put(`/invoices/${invoice._id}/handover`, body), {
    invalidate: [['invoices'], ['clients']],
    success: 'Handover details saved. Download the invoice again to send the updated copy.',
    onSuccess: () => setOpen(false),
  });
  const { register, handleSubmit, control, setValue } = useForm({
    defaultValues: {
      enabled: h.enabled ?? true,
      hostingMonths: String(h.hostingMonths ?? 12),
      maintenanceMonths: String(h.maintenanceMonths ?? 3),
      handoverDate: toDateInput(h.handoverDate) || todayISO(),
      startsOn: h.startDate ? 'date' : 'handover',
      startDate: toDateInput(h.startDate),
    },
  });
  const v = useWatch({ control });

  const status = (end, from) =>
    !end ? null
      : end < today ? <span className="text-red-600">expired</span>
      : new Date(from) > today ? <span className="text-muted">not started yet</span>
      : <span className="text-emerald-700">active</span>;

  return (
    <Card>
      <CardHeader title="Handover & maintenance" actions={<Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{h.enabled ? 'Edit' : 'Add'}</Button>} />
      {h.enabled ? (
        <dl className="space-y-2.5 px-5 py-4 text-sm">
          <div className="flex items-start gap-2"><CalendarCheck className="mt-0.5 size-4 text-muted" /><div><dt className="text-xs text-muted">Handed over</dt><dd className="font-semibold">{h.handoverDate ? formatLongDate(h.handoverDate) : 'Not yet'}</dd></div></div>
          {h.startDate && (
            <div className="flex items-start gap-2"><CalendarCheck className="mt-0.5 size-4 text-muted" /><div><dt className="text-xs text-muted">Free periods start</dt><dd className="font-semibold">{formatLongDate(h.startDate)}</dd></div></div>
          )}
          {h.hostingMonths > 0 && (
            <div className="flex items-start gap-2"><ServerCog className="mt-0.5 size-4 text-muted" /><div><dt className="text-xs text-muted">Free hosting · {periodLabel(h.hostingMonths)}</dt><dd className="font-semibold">{hostingEnd ? <>until {formatLongDate(hostingEnd)} · {status(hostingEnd, start)}</> : waiting}</dd></div></div>
          )}
          {h.maintenanceMonths > 0 && (
            <div className="flex items-start gap-2"><Wrench className="mt-0.5 size-4 text-muted" /><div><dt className="text-xs text-muted">Free maintenance · {periodLabel(h.maintenanceMonths)}</dt><dd className="font-semibold">{maintenanceEnd ? <>until {formatLongDate(maintenanceEnd)} · {status(maintenanceEnd, start)}</> : waiting}</dd></div></div>
          )}
        </dl>
      ) : (
        <p className="px-5 py-4 text-sm text-muted">No handover terms on this invoice.</p>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Handover, hosting & maintenance" size="md">
        {open && (
          <form onSubmit={handleSubmit((f) => save.mutate({ enabled: f.enabled, hostingMonths: Number(f.hostingMonths), maintenanceMonths: Number(f.maintenanceMonths), handoverDate: f.handoverDate || null, startDate: f.startsOn === 'date' ? f.startDate || null : null }))} className="space-y-4">
            <Switch checked={v.enabled} onChange={(on) => setValue('enabled', on)} label="Show on this invoice" />
            {v.enabled && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Free hosting"><Select {...register('hostingMonths')}>{HOSTING_PERIODS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}</Select></Field>
                <Field label="Free maintenance"><Select {...register('maintenanceMonths')}>{MAINTENANCE_PERIODS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}</Select></Field>
                <Field label="Handover date"><Input type="date" {...register('handoverDate')} /></Field>
                <Field label="Free periods start" className="sm:col-span-2">
                  <Select {...register('startsOn')}>
                    <option value="handover">On the handover date</option>
                    <option value="date">From a date I choose</option>
                  </Select>
                </Field>
                {v.startsOn === 'date' && <Field label="Start date" hint="Past or future."><Input type="date" required {...register('startDate')} /></Field>}
              </div>
            )}
            {save.isError && <p className="text-sm text-red-600">{errorMessage(save.error)}</p>}
            <ModalFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={save.isPending}>Save</Button>
            </ModalFooter>
          </form>
        )}
      </Modal>
    </Card>
  );
}
