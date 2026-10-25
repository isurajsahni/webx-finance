import { formatAmount, currencySymbol } from '../money.js';
import { esc, escLines } from './escape.js';

/** Two-column Description | Amount table used by vouchers and payslips. */
export function amountTable(rows, currency = 'INR', emptyText = 'Add a line') {
  const symbol = currencySymbol(currency).trim();
  const body = rows.length
    ? rows
        .map(
          (r) => `<tr><td><div class="item-title">${esc(r.title) || '&nbsp;'}</div>${r.desc ? `<div class="item-desc">${escLines(r.desc)}</div>` : ''}</td>
            <td class="num">${r.negative ? '− ' : ''}${esc(formatAmount(r.amount || 0, currency))}</td></tr>`,
        )
        .join('')
    : `<tr class="empty-row"><td colspan="2">${esc(emptyText)}</td></tr>`;
  return `<table class="items"><thead><tr><th>Description</th><th class="col-amount num">Amount (${esc(symbol)})</th></tr></thead><tbody>${body}</tbody></table>`;
}

export const moneyLabel = (minor, currency = 'INR') => `${currencySymbol(currency).trim()} ${formatAmount(minor || 0, currency)}`;

export function companyLines(company = {}) {
  return [{ text: company.name, bold: true }, company.address, (company.phones || []).join(' · '), [company.email, company.website].filter(Boolean).join(' · ')];
}

/** Mask an account number to its last four digits. */
export const maskAccount = (n) => (n ? `••••${String(n).slice(-4)}` : '');
