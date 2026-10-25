const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape any value for safe use in HTML text or attributes. */
export const esc = (v) => (v === null || v === undefined ? '' : String(v).replace(/[&<>"']/g, (c) => MAP[c]));

/** Escape and keep line breaks. */
export const escLines = (v) => esc(v).replace(/\r?\n/g, '<br>');
