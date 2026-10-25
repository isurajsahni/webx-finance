import { Router } from 'express';
import { ownerOnly } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import * as c from '../controllers/reportController.js';

export const ledger = Router();
ledger.get('/', c.ledger);
ledger.get('/balances', c.balances);
ledger.get('/entries', c.listEntries);
ledger.post('/entries', ownerOnly, c.createEntry);
ledger.post('/entries/:id/void', ownerOnly, validate({ params: idParams }), c.voidEntry);

export const reports = Router();
reports.get('/pnl', c.pnl);
reports.get('/pnl-fy', c.pnlFy);
reports.get('/income-by-client', c.incomeByClient);
reports.get('/expense-by-category', c.expenseByCategory);
reports.get('/receivables', c.receivables);
reports.get('/payouts', c.payouts);
reports.get('/gst', c.gst);

export const dashboard = c.dashboard;
