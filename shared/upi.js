// UPI "scan to pay" for invoices: a upi:// payment link and its QR code as inline SVG.
import QRCode from 'qrcode';

/** NPCI UPI deep link. Amount is in paise; note shows in the payer's app. */
export function upiLink({ upiId, payee, amountMinor, note }) {
  // The UPI ID is kept literal (some apps reject an encoded "@"); other values are percent-encoded.
  const parts = [`pa=${String(upiId).replace(/[^\w.@-]/g, '')}`, `pn=${encodeURIComponent((payee || '').slice(0, 50))}`];
  if (amountMinor > 0) parts.push(`am=${(amountMinor / 100).toFixed(2)}`);
  parts.push('cu=INR');
  if (note) parts.push(`tn=${encodeURIComponent(note.slice(0, 60))}`);
  return `upi://pay?${parts.join('&')}`;
}

/** QR code as an SVG string (synchronous, works in the browser and on the server). */
export function qrSvg(text, { size = 96, color = '#0A0A0A' } = {}) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const quiet = 2;
  const dim = n + quiet * 2;
  let path = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.modules.get(y, x)) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="UPI payment QR code"><rect width="${dim}" height="${dim}" fill="#fff"/><path d="${path}" fill="${color}"/></svg>`;
}
