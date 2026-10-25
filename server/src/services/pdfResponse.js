import { Settings } from '../models/index.js';
import { renderPdf } from './pdf.js';
import { documentAssets, footerFontCss } from './documentAssets.js';

/** Render a shared template to PDF and send it. `render(doc, { settings, assets })` returns HTML. */
export async function sendDocumentPdf(req, res, { doc, render, filename, files = [] }) {
  const settings = (await Settings.get()).toObject();
  const [assets, footerFont] = await Promise.all([documentAssets(settings, { files }), footerFontCss()]);
  const buffer = await renderPdf(render(doc, { settings, assets }), { footerText: settings.invoiceDefaults.footerText, footerFontCss: footerFont });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': buffer.length,
    'Content-Disposition': `${req.query.download ? 'attachment' : 'inline'}; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
  });
  res.end(buffer);
}
