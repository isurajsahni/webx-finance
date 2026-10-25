import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { ownerOnly } from '../middleware/auth.js';
import { idParams } from '../validators/common.js';
import { invoiceBody, cancelBody, listInvoicesQuery, handoverBody } from '../validators/invoices.js';
import * as c from '../controllers/invoiceController.js';

const r = Router();
r.get('/', validate({ query: listInvoicesQuery }), c.listInvoices);
r.get('/next-number', c.nextNumber);
r.get('/:id', validate({ params: idParams }), c.getInvoice);
r.get('/:id/pdf', validate({ params: idParams }), c.pdf);
r.post('/', validate({ body: invoiceBody }), c.create);
r.put('/:id', validate({ params: idParams, body: invoiceBody }), c.update);
r.put('/:id/handover', validate({ params: idParams, body: handoverBody }), c.updateHandover);
r.post('/:id/send', validate({ params: idParams }), c.markSent);
r.post('/:id/duplicate', validate({ params: idParams }), c.duplicate);
r.post('/:id/cancel', ownerOnly, validate({ params: idParams, body: cancelBody }), c.cancel);
export default r;
