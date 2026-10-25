// Invoice arithmetic shared by the browser (live preview) and the server (the
// numbers that get saved). All amounts are integers in minor units (paise).
import { formatMoney } from './money.js';
import { formatLongDate } from './fy.js';

export const lineAmount = (qty, rate) => Math.round(Number(qty || 0) * (rate || 0));

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * @param {object} input
 * @param {{title?:string, description?:string, sac?:string, qty:number, rate:number}[]} input.items
 * @param {{type:'percent'|'amount', value:number}} [input.discount] percent, or amount in minor units
 * @param {{enabled:boolean, rate:number, mode:'intra'|'inter'}} [input.gst]
 * @param {{type:'full'|'advance', advanceBy?:'percent'|'amount', advanceValue?:number}} [input.split]
 *        advanceValue is a percent, or an amount in minor units
 */
export function computeInvoice({ items = [], discount, gst, split } = {}) {
  const lines = items.map((it) => ({ ...it, qty: Number(it.qty ?? 1), rate: it.rate || 0, amount: lineAmount(it.qty ?? 1, it.rate) }));
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);

  let discountAmount = 0;
  const dv = Number(discount?.value) || 0;
  if (dv > 0) {
    discountAmount = discount.type === 'percent' ? Math.round((subtotal * Math.min(dv, 100)) / 100) : Math.min(Math.round(dv), subtotal);
  }
  const taxable = subtotal - discountAmount;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  const rate = Number(gst?.rate) || 0;
  if (gst?.enabled && rate > 0) {
    if (gst.mode === 'inter') igst = Math.round((taxable * rate) / 100);
    else {
      cgst = Math.round((taxable * rate) / 200);
      sgst = cgst;
    }
  }
  const taxTotal = cgst + sgst + igst;
  const total = taxable + taxTotal;

  let advanceAmount = 0;
  let advancePercent = null;
  if (split?.type === 'advance') {
    const v = Math.max(0, Number(split.advanceValue) || 0);
    if (split.advanceBy === 'amount') {
      advanceAmount = Math.min(Math.round(v), total);
      advancePercent = total ? round1((advanceAmount / total) * 100) : 0;
    } else {
      advancePercent = Math.min(v, 100);
      advanceAmount = Math.round((total * advancePercent) / 100);
    }
  }
  const balanceAmount = split?.type === 'advance' ? total - advanceAmount : 0;

  return {
    items: lines,
    subtotal,
    discountAmount,
    taxable,
    gst: { enabled: !!gst?.enabled && rate > 0, rate, mode: gst?.mode || 'intra', cgst, sgst, igst, taxTotal },
    total,
    split: {
      type: split?.type === 'advance' ? 'advance' : 'full',
      advanceBy: split?.advanceBy || 'percent',
      advanceValue: Number(split?.advanceValue) || 0,
      advanceAmount,
      advancePercent,
      balanceAmount,
    },
  };
}

const pct = (n) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** The default note, e.g. "30% advance (₹4,500) is payable to commence work. …" */
export function splitNote({ split, total, currency = 'INR', dueDate, paid }) {
  const fmt = (m) => formatMoney(m, currency);
  // Billed after money came in ("already paid"): paid = { amount, date (latest), count }.
  if (paid?.amount > 0) {
    const on = `${paid.count > 1 ? 'last payment on' : 'on'} ${formatLongDate(paid.date)}`;
    if (paid.amount >= total) return `Paid in full (${fmt(total)}), ${on}.`;
    const when = dueDate ? `by ${formatLongDate(dueDate)}` : 'on receipt of this invoice';
    return `${fmt(paid.amount)} already received (${on}). The balance of ${fmt(total - paid.amount)} is due ${when}.`;
  }
  if (split?.type === 'advance' && split.advanceAmount > 0) {
    const lead = split.advanceBy === 'amount' ? `An advance of ${fmt(split.advanceAmount)}` : `${pct(split.advancePercent)} advance (${fmt(split.advanceAmount)})`;
    const rest = split.balanceAmount > 0 ? ` The remaining balance of ${fmt(split.balanceAmount)} is due on completion, before final delivery.` : '';
    return `${lead} is payable to commence work.${rest}`;
  }
  const when = dueDate ? `by ${formatLongDate(dueDate)}` : 'on receipt of this invoice';
  return `Full payment of ${fmt(total)} is due ${when}.`;
}

/**
 * Same state → CGST + SGST ('intra'); different state or outside India → IGST ('inter').
 * Prefers the GSTIN state code, then the state name. Unknown → 'intra'.
 */
export function gstModeFor(company = {}, client = {}) {
  if (client.country && !/^\s*india\s*$/i.test(client.country)) return 'inter';
  const clientCode = client.gstin?.slice(0, 2) || client.stateCode;
  if (clientCode && company.stateCode) return clientCode === company.stateCode ? 'intra' : 'inter';
  if (client.state && company.state) {
    return client.state.trim().toLowerCase() === company.state.trim().toLowerCase() ? 'intra' : 'inter';
  }
  return 'intra';
}
