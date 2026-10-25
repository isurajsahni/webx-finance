import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, ownerOnly } from '../middleware/auth.js';
import auth from './auth.js';
import settings from './settings.js';
import bankAccounts from './bankAccounts.js';
import categories from './categories.js';
import users from './users.js';
import clients from './clients.js';
import invoices from './invoices.js';
import payments from './payments.js';
import { expenses, reimbursements, team, payouts } from './phase4.js';
import { ledger, reports, dashboard } from './phase5.js';
import { quotes, services } from './billing.js';
import { listAuditLogs } from '../controllers/auditController.js';
import { serveFile } from '../controllers/fileController.js';

const api = Router();

api.get('/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'up' : 'down' }));
api.use('/auth', auth);

// Everything below requires a signed-in user.
api.use(requireAuth);
api.use('/settings', settings);
api.use('/bank-accounts', bankAccounts);
api.use('/expense-categories', categories);
api.use('/users', users);
api.use('/clients', clients);
api.use('/invoices', invoices);
api.use('/payments', payments);
api.use('/quotes', quotes);
api.use('/services', services);
api.use('/expenses', expenses);
api.use('/reimbursements', reimbursements);
api.use('/team', team);
api.use('/payouts', payouts);
api.use('/ledger', ledger);
api.use('/reports', reports);
api.get('/dashboard', dashboard);
api.get('/audit-logs', ownerOnly, listAuditLogs);
api.get('/files/*key', serveFile);

export default api;
