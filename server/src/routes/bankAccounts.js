import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { ownerOnly } from '../middleware/auth.js';
import { idParams } from '../validators/common.js';
import { bankAccountBody } from '../validators/settings.js';
import * as c from '../controllers/bankAccountController.js';

const r = Router();
r.get('/', c.listBankAccounts);
r.get('/:id', validate({ params: idParams }), c.getBankAccount);
r.post('/', ownerOnly, validate({ body: bankAccountBody }), c.createBankAccount);
r.put('/:id', ownerOnly, validate({ params: idParams, body: bankAccountBody }), c.updateBankAccount);
r.post('/:id/default', ownerOnly, validate({ params: idParams }), c.makeDefault);
r.post('/:id/activate', ownerOnly, validate({ params: idParams }), c.setActive);
r.post('/:id/deactivate', ownerOnly, validate({ params: idParams }), c.setActive);
export default r;
