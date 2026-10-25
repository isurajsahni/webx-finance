// Indian states and union territories with their GST state codes.
export const INDIAN_STATES = [
  ['01', 'Jammu and Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'],
  ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'],
  ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'], ['26', 'Dadra and Nagar Haveli and Daman and Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'],
  ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman and Nicobar Islands'],
  ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'],
].map(([code, name]) => ({ code, name }));

const byName = new Map(INDIAN_STATES.map((s) => [s.name.toLowerCase(), s]));
const byCode = new Map(INDIAN_STATES.map((s) => [s.code, s]));

export const isIndia = (country) => !country || /^\s*india\s*$/i.test(country);

/** GST state code for a state name ("Punjab" → "03"), or ''. */
export function stateCodeFor(name) {
  return byName.get(String(name || '').trim().toLowerCase())?.code || '';
}

export function stateNameFor(code) {
  return byCode.get(String(code || ''))?.name || '';
}

/** "Punjab (03)" for place of supply. */
export function placeOfSupply(client = {}) {
  if (!isIndia(client.country)) return `Outside India (${client.country})`;
  const code = client.stateCode || client.gstin?.slice(0, 2) || stateCodeFor(client.state);
  const name = client.state || stateNameFor(code);
  return name ? `${name}${code ? ` (${code})` : ''}` : '';
}
