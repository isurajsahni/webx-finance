// Export tables as CSV, Excel or a branded PDF from one definition:
//   { title, subtitle, sheets: [{ name, columns: [{ key, label, type }], rows: [obj], total?: obj }] }
// type: 'money' (paise) | 'number' | 'percent' (0–1) | 'date' | 'text'
import ExcelJS from 'exceljs';
import { formatMoney } from '@webx/shared/money.js';
import { formatShortDate } from '@webx/shared/fy.js';
import { renderReport } from '@webx/shared/templates/index.js';
import { sendDocumentPdf } from './pdfResponse.js';

const raw = (v, type) => {
  if (v === null || v === undefined) return '';
  if (type === 'money') return Number((v / 100).toFixed(2));
  if (type === 'percent') return Number((v * 100).toFixed(1));
  if (type === 'date') return v ? new Date(v).toISOString().slice(0, 10) : '';
  return v;
};

const pretty = (v, type) => {
  if (v === null || v === undefined || v === '') return '';
  if (type === 'money') return formatMoney(v);
  if (type === 'percent') return `${(v * 100).toFixed(1)}%`;
  if (type === 'date') return formatShortDate(v);
  if (type === 'number') return new Intl.NumberFormat('en-IN').format(v);
  return String(v);
};

const csvCell = (v) => {
  const s = String(v ?? '');
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(def) {
  const parts = [];
  for (const sheet of def.sheets) {
    if (def.sheets.length > 1) parts.push(csvCell(sheet.name));
    const label = (c) => (c.type === 'money' ? `${c.label} (INR)` : c.type === 'percent' ? `${c.label} (%)` : c.label);
    parts.push(sheet.columns.map((c) => csvCell(label(c))).join(','));
    for (const r of sheet.rows) parts.push(sheet.columns.map((c) => csvCell(raw(r[c.key], c.type))).join(','));
    if (sheet.total) parts.push(sheet.columns.map((c) => csvCell(raw(sheet.total[c.key], c.type))).join(','));
    parts.push('');
  }
  return `﻿${parts.join('\r\n')}`; // BOM so Excel reads ₹ and other UTF-8 correctly
}

export async function toXlsx(def) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Web{X} Finance';
  for (const sheet of def.sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31).replace(/[\\/?*[\]:]/g, '-'));
    ws.columns = sheet.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 4, c.width || 0) }));
    for (const r of sheet.rows) ws.addRow(Object.fromEntries(sheet.columns.map((c) => [c.key, raw(r[c.key], c.type)])));
    if (sheet.total) ws.addRow(Object.fromEntries(sheet.columns.map((c) => [c.key, raw(sheet.total[c.key], c.type)]))).font = { bold: true };
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0A0A' } };
    sheet.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.type === 'money') col.numFmt = '#,##,##0.00';
      if (c.type === 'percent') col.numFmt = '0.0"%"';
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toReportDoc(def) {
  return {
    title: def.title,
    subtitle: def.subtitle,
    tables: def.sheets.map((s) => ({
      title: def.sheets.length > 1 ? s.name : '',
      columns: s.columns.map((c) => ({ label: c.label, align: ['money', 'number', 'percent'].includes(c.type) ? 'right' : 'left' })),
      rows: s.rows.map((r) => s.columns.map((c) => pretty(r[c.key], c.type))),
      total: s.total ? s.columns.map((c) => pretty(s.total[c.key], c.type)) : null,
    })),
  };
}

/** Send `def` in the requested format. */
export async function sendExport(req, res, def, format, filenameBase) {
  const name = filenameBase.replace(/[^\w.-]+/g, '-');
  if (format === 'csv') {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"` });
    return res.send(toCsv(def));
  }
  if (format === 'xlsx') {
    const buf = await toXlsx(def);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}.xlsx"`, 'Content-Length': buf.length });
    return res.end(buf);
  }
  req.query.download = '1';
  return sendDocumentPdf(req, res, {
    doc: toReportDoc(def),
    render: (doc, { settings, assets }) => renderReport({ ...doc, company: settings.company, footerText: settings.invoiceDefaults.footerText }, assets),
    filename: `${name}.pdf`,
  });
}
