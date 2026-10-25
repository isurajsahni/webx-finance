import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { ownerOnly } from '../middleware/auth.js';
import { idParams } from '../validators/common.js';
import { categoryBody } from '../validators/settings.js';
import * as c from '../controllers/categoryController.js';

const r = Router();
r.get('/', c.listCategories);
r.post('/', ownerOnly, validate({ body: categoryBody }), c.createCategory);
r.put('/:id', ownerOnly, validate({ params: idParams, body: categoryBody }), c.updateCategory);
export default r;
