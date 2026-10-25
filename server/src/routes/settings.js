import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { ownerOnly } from '../middleware/auth.js';
import { upload, LOGO_TYPES } from '../middleware/upload.js';
import { companyBody, numberingBody, preferencesBody, setNextNumberBody } from '../validators/settings.js';
import * as c from '../controllers/settingsController.js';

// Read access for everyone signed in (forms need defaults); writes are owner-only.
const r = Router();
r.get('/', c.getSettings);
r.get('/logo', c.getLogo);
r.get('/signature', c.getSignature);
r.get('/numbering/preview', c.numberingPreview);
r.put('/company', ownerOnly, validate({ body: companyBody }), c.updateCompany);
r.put('/preferences', ownerOnly, validate({ body: preferencesBody }), c.updatePreferences);
r.put('/numbering', ownerOnly, validate({ body: numberingBody }), c.updateNumbering);
r.post('/numbering/next', ownerOnly, validate({ body: setNextNumberBody }), c.setNext);
r.post('/logo', ownerOnly, upload(LOGO_TYPES).single('logo'), c.uploadLogo);
r.delete('/logo', ownerOnly, c.removeLogo);
r.post('/signature', ownerOnly, upload(LOGO_TYPES).single('signature'), c.uploadSignature);
r.delete('/signature', ownerOnly, c.removeSignature);
export default r;
