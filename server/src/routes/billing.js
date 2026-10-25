import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import { billingBody } from '../validators/invoices.js';
import * as q from '../controllers/quoteController.js';
import * as s from '../controllers/serviceController.js';

const id = validate({ params: idParams });

export const quotes = Router();
quotes.get('/', q.list);
quotes.get('/next-number', q.nextNumber);
quotes.get('/:id', id, q.get);
quotes.get('/:id/pdf', id, q.pdf);
quotes.post('/', validate({ body: billingBody }), q.create);
quotes.put('/:id', id, validate({ body: billingBody }), q.update);
quotes.post('/:id/send', id, q.send);
quotes.post('/:id/accept', id, q.accept);
quotes.post('/:id/decline', id, q.decline);
quotes.post('/:id/duplicate', id, q.duplicate);
quotes.post('/:id/convert', id, q.convert);

export const services = Router();
services.get('/', s.list);
services.post('/', validate({ body: s.serviceBody }), s.create);
services.put('/:id', id, validate({ body: s.serviceBody }), s.update);
