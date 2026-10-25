import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { ownerOnly } from '../middleware/auth.js';
import { upload, DOCUMENT_TYPES } from '../middleware/upload.js';
import { multipartJson } from '../middleware/multipartJson.js';
import { idParams } from '../validators/common.js';
import * as v from '../validators/phase4.js';
import * as e from '../controllers/expenseController.js';
import * as t from '../controllers/teamController.js';

const bills = upload(DOCUMENT_TYPES, { maxFiles: 5 }).array('bills', 5);
const id = validate({ params: idParams });

export const expenses = Router();
expenses.get('/', validate({ query: v.listExpensesQuery }), e.listExpenses);
expenses.get('/recurring-due', e.recurringDue);
expenses.get('/:id', id, e.getExpense);
expenses.get('/:id/voucher', id, e.voucherPdf(false));
expenses.post('/', bills, multipartJson, validate({ body: v.expenseBody }), e.createExpense);
expenses.put('/:id', id, bills, multipartJson, validate({ body: v.expenseBody }), e.updateExpense);
expenses.post('/:id/record-next', id, e.recordNext);
expenses.post('/:id/void', ownerOnly, id, validate({ body: v.reasonBody }), e.voidOne(false));

export const reimbursements = Router();
reimbursements.get('/', validate({ query: v.listExpensesQuery }), e.listReimbursements);
reimbursements.get('/:id', id, e.getReimbursement);
reimbursements.get('/:id/voucher', id, e.voucherPdf(true));
reimbursements.post('/', bills, multipartJson, validate({ body: v.reimbursementBody }), e.createReimbursement);
reimbursements.put('/:id', id, bills, multipartJson, validate({ body: v.reimbursementBody }), e.updateReimbursement);
reimbursements.post('/:id/approve', ownerOnly, id, e.approve);
reimbursements.post('/:id/reject', ownerOnly, id, validate({ body: v.reasonBody }), e.reject);
reimbursements.post('/:id/reimburse', id, validate({ body: v.reimburseBody }), e.reimburse);
reimbursements.post('/:id/void', ownerOnly, id, validate({ body: v.reasonBody }), e.voidOne(true));

export const team = Router();
team.get('/', t.listMembers);
team.get('/:id', id, t.getMember);
team.post('/', validate({ body: v.teamMemberBody }), t.createMember);
team.put('/:id', id, validate({ body: v.teamMemberBody }), t.updateMember);
team.post('/:id/activate', ownerOnly, id, t.setMemberActive);
team.post('/:id/deactivate', ownerOnly, id, t.setMemberActive);
team.post('/:id/photo', id, upload(['image/png', 'image/jpeg', 'image/webp']).single('photo'), t.uploadPhoto);
team.post('/:id/documents', id, upload(DOCUMENT_TYPES).single('file'), t.addDocument);
team.delete('/:id/documents/:docId', ownerOnly, t.removeDocument);

export const payouts = Router();
payouts.get('/', validate({ query: v.listPayoutsQuery }), t.listPayouts);
payouts.get('/:id', id, t.getPayout);
payouts.get('/:id/payslip', id, t.payslipPdf);
payouts.post('/', validate({ body: v.payoutBody }), t.createPayout);
payouts.post('/:id/void', ownerOnly, id, validate({ body: v.reasonBody }), t.voidPayout);
