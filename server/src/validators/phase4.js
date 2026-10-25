import { z } from 'zod';
import { PAYMENT_MODES, MEMBER_TYPES, PAY_BASIS, RECURRING_INTERVALS } from '@webx/shared/constants.js';
import { objectId, optStr, minor, businessDate, optPattern, IFSC_RX, UPI_RX, PAN_RX } from './common.js';

const expenseLine = z.object({ description: optStr(200), amount: minor.min(0) });

const expenseCore = {
  date: businessDate,
  category: objectId,
  vendor: optStr(120),
  description: optStr(1000),
  lines: z.array(expenseLine).min(1, 'Add at least one line').max(50),
  client: objectId.optional().nullable(),
  project: optStr(120),
  keepBills: z.array(z.string().max(300)).optional(), // on edit: storage keys of bills to keep
};

const positiveTotal = (v) => v.lines.reduce((s, l) => s + l.amount, 0) > 0;

export const expenseBody = z
  .object({
    ...expenseCore,
    vendor: z.string().trim().min(1, 'Who was paid?').max(120),
    mode: z.enum(PAYMENT_MODES),
    reference: optStr(80),
    paidFrom: objectId,
    recurring: z
      .object({ enabled: z.boolean(), interval: z.enum(RECURRING_INTERVALS).optional(), nextDueDate: businessDate.optional().nullable() })
      .default({ enabled: false }),
  })
  .refine(positiveTotal, { path: ['lines'], message: 'Total must be more than 0' })
  .refine((v) => !v.recurring.enabled || v.recurring.interval, { path: ['recurring', 'interval'], message: 'Choose monthly or yearly' });

export const reimbursementBody = z
  .object({
    ...expenseCore,
    payeeType: z.enum(['owner', 'member']),
    member: objectId.optional().nullable(),
    payeeName: optStr(120),
  })
  .refine(positiveTotal, { path: ['lines'], message: 'Total must be more than 0' })
  .refine((v) => v.payeeType !== 'member' || v.member, { path: ['member'], message: 'Choose the team member' });

export const reimburseBody = z.object({
  date: businessDate,
  paidFrom: objectId,
  mode: z.enum(PAYMENT_MODES),
  reference: optStr(80),
});

export const reasonBody = z.object({ reason: z.string().trim().min(3, 'Give a reason (min 3 characters)').max(500) });

export const listExpensesQuery = z.object({
  category: objectId.optional(),
  client: objectId.optional(),
  paidFrom: objectId.optional(),
  mode: z.enum(PAYMENT_MODES).optional(),
  status: z.enum(['active', 'void']).optional(),
  reimbursementStatus: z.enum(['submitted', 'approved', 'reimbursed', 'rejected', 'pending']).optional(),
  member: objectId.optional(),
  recurring: z.enum(['1']).optional(),
  from: businessDate.optional(),
  to: businessDate.optional(),
});

const email = z.union([z.literal(''), z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'))]).default('');
const mobile = optPattern(/^\+?[\d\s-]{10,16}$/, 'Enter a valid mobile number');

export const teamMemberBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  role: optStr(80),
  department: optStr(60),
  type: z.enum(MEMBER_TYPES),
  payBasis: z.enum(PAY_BASIS),
  monthlySalary: minor.min(0).default(0),
  projectRate: minor.min(0).default(0),
  phone: mobile,
  alternatePhone: mobile,
  email,
  personalEmail: email,
  joiningDate: businessDate.optional().nullable(),
  status: z.enum(['active', 'on_notice', 'left']).default('active'),
  exitDate: businessDate.optional().nullable(),
  exitReason: optStr(300),
  dateOfBirth: businessDate.optional().nullable(),
  bloodGroup: z.union([z.literal(''), z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])]).default(''),
  address: optStr(400),
  city: optStr(80),
  state: optStr(60),
  pincode: optPattern(/^\d{6}$/, 'PIN code is 6 digits'),
  emergencyContact: z.object({ name: optStr(120), relation: optStr(40), phone: mobile }).default({}),
  pan: optPattern(PAN_RX, 'Invalid PAN', { upper: true }),
  aadhaarLast4: optPattern(/^\d{4}$/, 'Last 4 digits only'),
  uan: optPattern(/^\d{12}$/, 'UAN is 12 digits'),
  payoutDetails: z.object({
    method: z.enum(['upi', 'bank']),
    upiId: optPattern(UPI_RX, 'Invalid UPI ID'),
    accountName: optStr(120),
    accountNumber: optPattern(/^[0-9A-Z]{6,20}$/, '6–20 letters or digits', { upper: true }),
    ifsc: optPattern(IFSC_RX, 'Invalid IFSC', { upper: true }),
    bankName: optStr(100),
  }),
  notes: optStr(1000),
});

const payLine = z.object({ label: z.string().trim().min(1, 'Add a label').max(120), note: optStr(200), amount: minor.min(0) });

export const payoutBody = z
  .object({
    member: objectId,
    date: businessDate,
    periodLabel: optStr(60),
    periodStart: businessDate.optional().nullable(),
    periodEnd: businessDate.optional().nullable(),
    project: optStr(120),
    client: objectId.optional().nullable(),
    earnings: z.array(payLine).min(1, 'Add at least one earning').max(30),
    deductions: z.array(payLine).max(30).default([]),
    bonus: minor.min(0).default(0),
    mode: z.enum(PAYMENT_MODES),
    reference: optStr(80),
    paidFrom: objectId,
    notes: optStr(1000),
  })
  .refine((v) => v.periodLabel || v.project, { path: ['periodLabel'], message: 'Add a period or a project' })
  .refine((v) => v.earnings.reduce((s, e) => s + e.amount, 0) + v.bonus - v.deductions.reduce((s, d) => s + d.amount, 0) > 0, {
    path: ['deductions'],
    message: 'Net pay must be more than 0',
  });

export const listPayoutsQuery = z.object({
  member: objectId.optional(),
  status: z.enum(['active', 'void']).optional(),
  from: businessDate.optional(),
  to: businessDate.optional(),
});
