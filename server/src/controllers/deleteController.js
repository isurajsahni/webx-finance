import * as d from '../services/deletion.js';

/** DELETE handlers: owner only (see routes), permanent. */
const handler = (fn) => async (req, res) => res.json({ deleted: true, ...(await fn(req.params.id, req.user, req.ip)) });

export const invoice = handler(d.deleteInvoice);
export const payment = handler(d.deletePayment);
export const quote = handler(d.deleteQuote);
export const expense = handler((id, user, ip) => d.deleteExpense(id, false, user, ip));
export const reimbursement = handler((id, user, ip) => d.deleteExpense(id, true, user, ip));
export const payout = handler(d.deletePayout);
export const ledgerEntry = handler(d.deleteLedgerEntry);
export const client = handler(d.deleteClient);
