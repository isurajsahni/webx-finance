import { isIndia, placeOfSupply } from '../india.js';

/** Address and contact lines for a client block (BILLED TO / RECEIVED FROM). */
export function clientLines(client = {}, { withPlaceOfSupply = false } = {}) {
  const cityLine = [client.city, [client.state, client.pincode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const tax = [client.gstin && `GSTIN: ${client.gstin}`, client.pan && `PAN: ${client.pan}`].filter(Boolean).join(' · ');
  return [
    { text: client.name || 'Client name', bold: true },
    client.secondaryName,
    client.contactPerson && client.contactPerson !== client.name ? `Attn: ${client.contactPerson}` : '',
    client.address,
    cityLine,
    !isIndia(client.country) ? client.country : '',
    [client.phone, client.email].filter(Boolean).join(' · '),
    tax,
    withPlaceOfSupply && placeOfSupply(client) ? { text: `Place of supply: ${placeOfSupply(client)}`, small: true } : '',
  ];
}

/** Resolve an uploaded file (e.g. client logo) to an <img> src via the caller's assets. */
export const fileSrc = (assets, file) => (file?.key && assets?.resolveFile ? assets.resolveFile(file.key) : '');
