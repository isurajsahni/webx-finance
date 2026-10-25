import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { loginLimiter, authLimiter } from '../middleware/rateLimit.js';
import { loginBody, changePasswordBody } from '../validators/auth.js';
import * as c from '../controllers/authController.js';

const r = Router();
r.use(authLimiter);
r.post('/login', loginLimiter, validate({ body: loginBody }), c.login);
r.post('/logout', c.logout);
r.get('/me', requireAuth, c.me);
r.post('/change-password', requireAuth, loginLimiter, validate({ body: changePasswordBody }), c.changePassword);
export default r;
