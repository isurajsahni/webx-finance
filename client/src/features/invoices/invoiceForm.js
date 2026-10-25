// Mapping between the invoice form (strings, as typed) and the API (paise,
// numbers), plus the live-preview model built with the shared invoice maths.
import { z } from 'zod';
import { PAYMENT_MODES } from '@webx/shared/constants.js';
import { computeInvoice, splitNote, gstModeFor } from '@webx/shared/invoiceMath.js';
import { fromMinor, toMinor } from '@webx/shared/money.js';
import { toDateInput, todayISO } from '@webx/shared/fy.js';
import { clientSchema, emptyClient } from '@/features/clients/ClientForm';

export const emptyItem = () => ({ title: '', description: '', sac: '', qty: '1', rate: '' });

const num = (v) => Number(String(v ?? '').replace(/,/g, ''));
const isPositive = (v) => String(v).trim() !== '' && Number.isFinite(num(v)) && num(v) > 0;

export const invoiceFormSchema = z
  .object({
    clientMode: z.enum(['existing', 'new']),
    client: z.string(),
    newClient: z.any(),
    numberMode: z.enum(['auto', 'manual']),
    number: z.string().trim().max(40),
    issueDate: z.string().min(1, 'Pick a date'),
    dueType: z.enum(['text', 'date']),
    dueText: z.string().trim().max(80),
    dueDate: z.string(),
    currency: z.string(),
    exchangeRate: z.string(),
    items: z
      .array(
        z.object({
          title: z.string().trim().min(1, 'Add a title').max(200),
          description: z.string().trim().max(1000),
          sac: z.string().trim().max(12),
          qty: z.string().refine(isPositive, 'Qty > 0').refine((v) => Math.round(num(v) * 100) === num(v) * 100, 'Max 2 decimals'),
          rate: z.string().refine((v) => toMinor(v) !== null && toMinor(v) >= 0, 'Enter a rate'),
        }),
      )
      .min(1, 'Add at least one line item'),
    discountType: z.enum(['amount', 'percent']),
    discountValue: z.string(),
    gstEnabled: z.boolean(),
    gstRate: z.string(),
    splitType: z.enum(['full', 'advance']),
    advanceBy: z.enum(['percent', 'amount']),
    advanceValue: z.string(),
    bankAccount: z.string(),
    note: z.string().max(2000),
    noteIsCustom: z.boolean(),
    terms: z.string().max(2000),
    validUntil: z.string(),
    hoEnabled: z.boolean(),
    hostingMonths: z.string(),
    maintenanceMonths: z.string(),
    handoverDate: z.string(),
    hoStartsOn: z.enum(['handover', 'date']),
    hoStartDate: z.string(),
    // "Already paid": money received before the bill was made, each payment with its own amount and date.
    paidOn: z.boolean(),
    paidRows: z.array(
      z.object({
        date: z.string(),
        amount: z.string(),
        mode: z.enum(PAYMENT_MODES),
        reference: z.string().trim().max(80),
        account: z.string(),
      }),
    ),
    paidTdsOn: z.boolean(),
    paidTds: z.string(),
  })
  .superRefine((v, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path, message });
    if (v.clientMode === 'existing' && !v.client) issue(['client'], 'Choose a client');
    if (v.clientMode === 'new') {
      const r = clientSchema.safeParse({ ...emptyClient, ...v.newClient });
      if (!r.success) r.error.issues.forEach((i) => issue(['newClient', ...i.path], i.message));
    }
    if (v.numberMode === 'manual' && !/^[A-Za-z0-9/_-]+$/.test(v.number)) issue(['number'], 'Letters, numbers, / _ - only');
    if (v.dueType === 'date' && !v.dueDate) issue(['dueDate'], 'Pick a due date');
    if (v.currency !== 'INR' && !isPositive(v.exchangeRate)) issue(['exchangeRate'], 'Enter the INR rate');
    if (v.discountValue.trim()) {
      if (v.discountType === 'percent' && !(num(v.discountValue) >= 0 && num(v.discountValue) <= 100)) issue(['discountValue'], '0–100%');
      if (v.discountType === 'amount' && (toMinor(v.discountValue) === null || toMinor(v.discountValue) < 0)) issue(['discountValue'], 'Enter an amount');
    }
    if (v.splitType === 'advance') {
      if (v.advanceBy === 'percent' && !(num(v.advanceValue) > 0 && num(v.advanceValue) <= 100)) issue(['advanceValue'], '1–100%');
      if (v.advanceBy === 'amount' && !(toMinor(v.advanceValue) > 0)) issue(['advanceValue'], 'Enter the advance');
    }
    if (v.hoEnabled && v.hoStartsOn === 'date' && !v.hoStartDate) issue(['hoStartDate'], 'Pick the start date');
    if (v.paidOn) {
      if (!v.paidRows.length) issue(['paidRows'], 'Add the payment received');
      v.paidRows.forEach((r, i) => {
        if (!r.date) issue(['paidRows', i, 'date'], 'Pick the date');
        if (!(toMinor(r.amount) > 0)) issue(['paidRows', i, 'amount'], 'Enter the amount');
      });
      if (v.paidTdsOn && !(toMinor(v.paidTds) > 0)) issue(['paidTds'], 'Enter the TDS amount');
    }
  });

const addDaysISO = (iso, days) => toDateInput(new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86400000));

export function defaultValues(settings, { clientId = '', bankId = '', docType = 'invoice', paid = false } = {}) {
  const ho = settings?.handoverDefaults || {};
  const today = todayISO();
  const values = {
    clientMode: 'existing',
    client: clientId,
    newClient: { ...emptyClient },
    numberMode: 'auto',
    number: '',
    issueDate: todayISO(),
    dueType: 'text',
    dueText: settings?.invoiceDefaults?.dueText ?? 'On receipt (advance)',
    dueDate: '',
    currency: 'INR',
    exchangeRate: '1',
    items: [emptyItem()],
    discountType: 'amount',
    discountValue: '',
    gstEnabled: !!settings?.gst?.enabled,
    gstRate: String(settings?.gst?.defaultRate ?? 18),
    splitType: 'advance',
    advanceBy: 'percent',
    advanceValue: String(settings?.invoiceDefaults?.advancePercent ?? 30),
    bankAccount: bankId,
    note: '',
    noteIsCustom: false,
    terms: settings?.invoiceDefaults?.terms ?? '',
    validUntil: docType === 'quote' ? addDaysISO(today, settings?.quoteDefaults?.validityDays ?? 15) : '',
    hoEnabled: !!ho.enabledByDefault,
    hostingMonths: String(ho.hostingMonths ?? 12),
    maintenanceMonths: String(ho.maintenanceMonths ?? 3),
    handoverDate: '',
    hoStartsOn: 'handover',
    hoStartDate: '',
    ...paidDefaults(today, bankId),
  };
  return paid ? { ...values, ...paidSwitchValues(true, values) } : values;
}

export const emptyPaidRow = (date, account = '') => ({ date, amount: '', mode: 'upi', reference: '', account });

function paidDefaults(date, account) {
  return { paidOn: false, paidRows: [emptyPaidRow(date, account)], paidTdsOn: false, paidTds: '' };
}

/** Switching "already paid" on: payments are listed one by one, so no advance split. */
export function paidSwitchValues(on, v) {
  if (!on) return { paidOn: false };
  const rows = v.paidRows?.length ? v.paidRows : [emptyPaidRow(v.issueDate, v.bankAccount)];
  return { paidOn: true, splitType: 'full', paidRows: rows.map((r) => (r.amount ? r : { ...r, date: v.issueDate })) };
}

export function fromInvoice(inv, settings) {
  return {
    ...defaultValues(settings),
    client: String(inv.client),
    numberMode: inv.number ? 'manual' : 'auto',
    number: inv.number || '',
    issueDate: toDateInput(inv.issueDate),
    dueType: inv.dueDate ? 'date' : 'text',
    dueText: inv.dueText || '',
    dueDate: toDateInput(inv.dueDate),
    currency: inv.currency,
    exchangeRate: String(inv.exchangeRate ?? 1),
    items: inv.items.map((i) => ({ title: i.title, description: i.description || '', sac: i.sac || '', qty: String(i.qty), rate: fromMinor(i.rate) })),
    discountType: inv.discount?.type || 'amount',
    discountValue: inv.discount?.value ? (inv.discount.type === 'percent' ? String(inv.discount.value) : fromMinor(inv.discount.value)) : '',
    gstEnabled: !!inv.gst?.enabled,
    gstRate: String(inv.gst?.rate || settings?.gst?.defaultRate || 18),
    splitType: inv.split?.type || 'full',
    advanceBy: inv.split?.advanceBy || 'percent',
    advanceValue: inv.split?.type === 'advance' ? (inv.split.advanceBy === 'amount' ? fromMinor(inv.split.advanceValue) : String(inv.split.advanceValue)) : String(settings?.invoiceDefaults?.advancePercent ?? 30),
    bankAccount: inv.bankAccount?._id || inv.bankAccount || '',
    note: inv.note || '',
    noteIsCustom: !!inv.noteIsCustom,
    terms: inv.terms ?? settings?.invoiceDefaults?.terms ?? '',
    validUntil: toDateInput(inv.validUntil),
    hoEnabled: !!inv.handover?.enabled,
    hostingMonths: String(inv.handover?.enabled ? inv.handover.hostingMonths : settings?.handoverDefaults?.hostingMonths ?? 12),
    maintenanceMonths: String(inv.handover?.enabled ? inv.handover.maintenanceMonths : settings?.handoverDefaults?.maintenanceMonths ?? 3),
    handoverDate: toDateInput(inv.handover?.handoverDate),
    hoStartsOn: inv.handover?.startDate ? 'date' : 'handover',
    hoStartDate: toDateInput(inv.handover?.startDate),
    ...paidDefaults(toDateInput(inv.issueDate), inv.bankAccount?._id || inv.bankAccount || ''),
  };
}

/**
 * Payments received before billing, oldest first, in paise. TDS (if any) goes
 * on the latest payment, the one that settles the bill.
 */
export function paidPayments(v) {
  if (!v.paidOn) return [];
  const rows = (v.paidRows || [])
    .map((r) => ({ date: r.date, amount: toMinor(r.amount) || 0, mode: r.mode, reference: r.reference, bankAccount: r.account || null, tds: 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length && v.paidTdsOn) rows[rows.length - 1].tds = toMinor(v.paidTds) || 0;
  return rows;
}

/** Total received (with TDS), latest date and count, as the shared note expects. */
export function paidSummary(rows) {
  if (!rows.length) return null;
  return { amount: rows.reduce((s, r) => s + r.amount + r.tds, 0), date: rows[rows.length - 1].date, count: rows.length };
}

/** Form values → API inputs for computeInvoice and for saving. */
function coreInputs(v) {
  const items = (v.items || []).map((i) => ({ title: i.title, description: i.description, sac: i.sac, qty: num(i.qty) || 0, rate: toMinor(i.rate) ?? 0 }));
  const dv = v.discountValue?.trim() ? (v.discountType === 'percent' ? num(v.discountValue) : toMinor(v.discountValue) ?? 0) : 0;
  const advanceValue = v.splitType === 'advance' ? (v.advanceBy === 'percent' ? num(v.advanceValue) || 0 : toMinor(v.advanceValue) ?? 0) : 0;
  return {
    items,
    discount: { type: v.discountType, value: dv },
    split: { type: v.splitType, advanceBy: v.advanceBy, advanceValue },
  };
}

/** Handover block as sent to the API (lists are filled from Settings on the server). */
export const handoverPayload = (v) =>
  v.hoEnabled
    ? { enabled: true, hostingMonths: Number(v.hostingMonths) || 0, maintenanceMonths: Number(v.maintenanceMonths) || 0, handoverDate: v.handoverDate || null, startDate: v.hoStartsOn === 'date' ? v.hoStartDate || null : null }
    : { enabled: false };

export function toPayload(v, { status, lockedNumber, docType = 'invoice' } = {}) {
  const core = coreInputs(v);
  return {
    ...(v.clientMode === 'new' ? { newClient: v.newClient } : { client: v.client }),
    ...(!lockedNumber && v.numberMode === 'manual' ? { number: v.number.trim() } : {}),
    issueDate: v.issueDate,
    dueText: v.dueType === 'text' ? v.dueText : '',
    dueDate: v.dueType === 'date' ? v.dueDate : null,
    currency: v.currency,
    exchangeRate: v.currency === 'INR' ? 1 : num(v.exchangeRate),
    items: core.items,
    discount: core.discount,
    gstEnabled: v.gstEnabled,
    gstRate: num(v.gstRate) || 0,
    split: core.split,
    bankAccount: v.bankAccount || null,
    note: v.note,
    noteIsCustom: v.noteIsCustom,
    terms: v.terms,
    handover: handoverPayload(v),
    ...(docType === 'quote' ? { validUntil: v.validUntil || null } : {}),
    ...(docType === 'invoice' && v.paidOn ? { paid: paidPayments(v) } : {}),
    ...(status ? { status } : {}),
  };
}

/** Everything the template needs, computed exactly as the server will. */
export function previewModel(v, { settings, client, bank, number, docType = 'invoice', existing }) {
  const core = coreInputs(v);
  const company = settings?.company || {};
  const gstOn = !!settings?.gst?.enabled && v.gstEnabled;
  const computed = computeInvoice({
    ...core,
    gst: { enabled: gstOn, rate: num(v.gstRate) || 0, mode: gstModeFor(company, client || {}) },
  });
  const dueDate = v.dueType === 'date' && v.dueDate ? v.dueDate : null;
  // An "already paid" invoice previews exactly as it will be saved: its payments listed, then the balance.
  const paidRows = docType === 'invoice' && computed.total > 0 ? paidPayments(v).filter((r) => r.date && r.amount + r.tds > 0) : [];
  const received = paidSummary(paidRows);
  const splitText = splitNote({ split: computed.split, total: computed.total, currency: v.currency, dueDate, paid: received });
  const quoteLine = docType === 'quote' ? settings?.quoteDefaults?.note : '';
  const autoNote = quoteLine ? `${splitText} ${quoteLine}` : splitText;
  let settled = 0;
  const paidPreview = received
    ? {
        status: received.amount >= computed.total ? 'paid' : 'partly_paid',
        payments: paidRows.map((r) => {
          settled += r.amount + r.tds;
          return { ...r, receiptNumber: '', purpose: settled >= computed.total ? 'final' : 'part' };
        }),
      }
    : {};
  return {
    autoNote,
    invoice: {
      ...computed,
      discount: core.discount,
      currency: v.currency,
      number,
      issueDate: v.issueDate,
      dueDate,
      dueText: v.dueType === 'text' ? v.dueText : '',
      note: v.noteIsCustom ? v.note : autoNote,
      terms: v.terms,
      docType,
      validUntil: v.validUntil,
      handover: {
        ...handoverPayload(v),
        includes: existing?.handover?.includes?.length ? existing.handover.includes : settings?.handoverDefaults?.includes,
        excludes: existing?.handover?.excludes?.length ? existing.handover.excludes : settings?.handoverDefaults?.excludes,
      },
      snapshot: { company, client: client || {}, bank: bank?.kind === 'bank' ? bank : null },
      ...paidPreview,
    },
  };
}
