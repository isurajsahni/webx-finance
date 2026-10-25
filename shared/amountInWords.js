// Amounts in words for receipts and payslips.
// INR uses the Indian system (lakh, crore); other currencies use million/billion.

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n) {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(' ');
}

function belowThousand(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? belowHundred(r) : ''].filter(Boolean).join(' ');
}

function indian(n) {
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 1e7);
  if (crore) parts.push(`${indian(crore)} Crore`);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  n %= 1e5;
  const thousand = Math.floor(n / 1000);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  n %= 1000;
  if (n) parts.push(belowThousand(n));
  return parts.join(' ');
}

function international(n) {
  if (n === 0) return 'Zero';
  const scales = [
    [1e9, 'Billion'],
    [1e6, 'Million'],
    [1e3, 'Thousand'],
  ];
  const parts = [];
  for (const [size, name] of scales) {
    const q = Math.floor(n / size);
    if (q) parts.push(`${international(q)} ${name}`);
    n %= size;
  }
  if (n) parts.push(belowThousand(n));
  return parts.join(' ');
}

const NAMES = {
  INR: ['Rupees', 'Paise'],
  USD: ['US Dollars', 'Cents'],
  GBP: ['Pounds Sterling', 'Pence'],
  EUR: ['Euros', 'Cents'],
  AED: ['UAE Dirhams', 'Fils'],
};

/** 450000 → "Rupees Four Thousand Five Hundred Only" (amount in minor units). */
export function amountInWords(minor, currency = 'INR') {
  const abs = Math.abs(Math.round(minor || 0));
  const major = Math.floor(abs / 100);
  const fraction = abs % 100;
  const [majorName, minorName] = NAMES[currency] || [currency, 'Cents'];
  const words = currency === 'INR' ? indian : international;
  if (!major && fraction) return `${words(fraction)} ${minorName} Only`;
  const main = `${majorName} ${words(major)}`;
  const tail = fraction ? ` and ${words(fraction)} ${minorName}` : '';
  return `${main}${tail} Only`;
}
