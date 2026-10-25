import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { ownerOnly } from '../middleware/auth.js';
import { idParams } from '../validators/common.js';
import { createUserBody, updateUserBody, resetPasswordBody } from '../validators/users.js';
import * as c from '../controllers/userController.js';

const r = Router();
r.use(ownerOnly);
r.get('/', c.listUsers);
r.post('/', validate({ body: createUserBody }), c.createUser);
r.put('/:id', validate({ params: idParams, body: updateUserBody }), c.updateUser);
r.post('/:id/reset-password', validate({ params: idParams, body: resetPasswordBody }), c.resetPassword);
export default r;
