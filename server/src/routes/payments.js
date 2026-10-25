import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { ownerOnly } from '../middleware/auth.js';
import { upload, DOCUMENT_TYPES } from '../middleware/upload.js';
import { multipartJson } from '../middleware/multipartJson.js';
import { idParams } from '../validators/common.js';
import { paymentBody, voidBody, listPaymentsQuery } from '../validators/payments.js';
import * as c from '../controllers/paymentController.js';

const r = Router();
r.get('/', validate({ query: listPaymentsQuery }), c.listPayments);
r.get('/:id', validate({ params: idParams }), c.getPayment);
r.get('/:id/receipt', validate({ params: idParams }), c.receiptPdf);
// JSON, or multipart with `data` (JSON) + optional `proof` file.
r.post('/', upload(DOCUMENT_TYPES).single('proof'), multipartJson, validate({ body: paymentBody }), c.create);
r.post('/:id/proof', validate({ params: idParams }), upload(DOCUMENT_TYPES).single('proof'), c.uploadProof);
r.post('/:id/void', ownerOnly, validate({ params: idParams, body: voidBody }), c.voidOne);
export default r;
