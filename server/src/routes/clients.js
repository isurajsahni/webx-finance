import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { ownerOnly } from '../middleware/auth.js';
import { idParams } from '../validators/common.js';
import { upload, LOGO_TYPES } from '../middleware/upload.js';
import { clientBody } from '../validators/clients.js';
import * as c from '../controllers/clientController.js';

const r = Router();
r.get('/', c.listClients);
r.get('/:id', validate({ params: idParams }), c.getClient);
r.get('/:id/statement', validate({ params: idParams }), c.statement);
r.post('/', validate({ body: clientBody }), c.createClient);
r.put('/:id', validate({ params: idParams, body: clientBody }), c.updateClient);
r.post('/:id/logo', validate({ params: idParams }), upload(LOGO_TYPES).single('logo'), c.uploadLogo);
r.delete('/:id/logo', validate({ params: idParams }), c.removeLogo);
r.post('/:id/archive', ownerOnly, validate({ params: idParams }), c.setArchived);
r.post('/:id/unarchive', ownerOnly, validate({ params: idParams }), c.setArchived);
export default r;
