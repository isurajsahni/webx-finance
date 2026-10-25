import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fromMinor, toMinor } from '@webx/shared/money.js';
import { toDateInput } from '@webx/shared/fy.js';
import { INDIAN_STATES } from '@webx/shared/india.js';
import { api, errorMessage } from '@/api/client';
import { Button, Field, Input, ModalFooter, MoneyInput, Select, Textarea } from '@/components/ui';
import { IFSC_RX, PAN_RX, UPI_RX, moneyString, optPattern, optUpperPattern } from '@/lib/validation';

const mobile = optPattern(/^\+?[\d\s-]{10,16}$/, 'Enter a valid mobile number');
const email = z.union([z.literal(''), z.email('Enter a valid email')]);
const BLOOD = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    role: z.string().trim().max(80),
    department: z.string().trim().max(60),
    type: z.enum(['employee', 'freelancer']),
    status: z.enum(['active', 'on_notice', 'left']),
    joiningDate: z.string(),
    exitDate: z.string(),
    exitReason: z.string().trim().max(300),
    payBasis: z.enum(['monthly', 'per_project']),
    monthlySalary: moneyString(),
    projectRate: moneyString(),
    phone: mobile,
    alternatePhone: mobile,
    email,
    personalEmail: email,
    dateOfBirth: z.string(),
    bloodGroup: z.string(),
    address: z.string().trim().max(400),
    city: z.string().trim().max(80),
    state: z.string().trim().max(60),
    pincode: optPattern(/^\d{6}$/, '6 digits'),
    ecName: z.string().trim().max(120),
    ecRelation: z.string().trim().max(40),
    ecPhone: mobile,
    pan: optUpperPattern(PAN_RX, 'Invalid PAN'),
    aadhaarLast4: optPattern(/^\d{4}$/, 'Last 4 digits only'),
    uan: optPattern(/^\d{12}$/, '12 digits'),
    method: z.enum(['upi', 'bank']),
    upiId: optPattern(UPI_RX, 'Invalid UPI ID'),
    accountName: z.string().trim().max(120),
    accountNumber: optUpperPattern(/^[0-9A-Z]{6,20}$/, '6–20 letters or digits'),
    ifsc: optUpperPattern(IFSC_RX, 'Invalid IFSC'),
    bankName: z.string().trim().max(100),
    notes: z.string().trim().max(1000),
  })
  .superRefine((v, ctx) => {
    if (v.status !== 'active' && !v.exitDate) ctx.addIssue({ code: 'custom', path: ['exitDate'], message: v.status === 'left' ? 'When did they leave?' : 'Last working day' });
  });

const d = toDateInput;
const toForm = (m) => ({
  name: m?.name || '',
  role: m?.role || '',
  department: m?.department || '',
  type: m?.type || 'employee',
  status: m?.status || (m && m.isActive === false ? 'left' : 'active'),
  joiningDate: d(m?.joiningDate),
  exitDate: d(m?.exitDate),
  exitReason: m?.exitReason || '',
  payBasis: m?.payBasis || 'monthly',
  monthlySalary: m?.monthlySalary ? fromMinor(m.monthlySalary) : '',
  projectRate: m?.projectRate ? fromMinor(m.projectRate) : '',
  phone: m?.phone || '',
  alternatePhone: m?.alternatePhone || '',
  email: m?.email || '',
  personalEmail: m?.personalEmail || '',
  dateOfBirth: d(m?.dateOfBirth),
  bloodGroup: m?.bloodGroup || '',
  address: m?.address || '',
  city: m?.city || '',
  state: m?.state || '',
  pincode: m?.pincode || '',
  ecName: m?.emergencyContact?.name || '',
  ecRelation: m?.emergencyContact?.relation || '',
  ecPhone: m?.emergencyContact?.phone || '',
  pan: m?.pan || '',
  aadhaarLast4: m?.aadhaarLast4 || '',
  uan: m?.uan || '',
  method: m?.payoutDetails?.method || 'upi',
  upiId: m?.payoutDetails?.upiId || '',
  accountName: m?.payoutDetails?.accountName || '',
  accountNumber: m?.payoutDetails?.accountNumber || '',
  ifsc: m?.payoutDetails?.ifsc || '',
  bankName: m?.payoutDetails?.bankName || '',
  notes: m?.notes || '',
});

// Server field path → form field name, so server errors land on the right input.
const SERVER_PATHS = {
  'emergencyContact.name': 'ecName', 'emergencyContact.relation': 'ecRelation', 'emergencyContact.phone': 'ecPhone',
  'payoutDetails.upiId': 'upiId', 'payoutDetails.accountNumber': 'accountNumber', 'payoutDetails.ifsc': 'ifsc', 'payoutDetails.accountName': 'accountName', 'payoutDetails.bankName': 'bankName',
};

function Section({ title, hint, children }) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[11px] font-bold tracking-wider text-muted uppercase">{title}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function MemberForm({ member, onDone, onCancel }) {
  const { register, handleSubmit, control, formState, setError } = useForm({ resolver: zodResolver(schema), defaultValues: toForm(member) });
  const [status, method, payBasis] = useWatch({ control, name: ['status', 'method', 'payBasis'] });
  const e = formState.errors;

  const onSubmit = async (f) => {
    const body = {
      name: f.name, role: f.role, department: f.department, type: f.type, status: f.status,
      joiningDate: f.joiningDate || null, exitDate: f.status === 'active' ? null : f.exitDate || null, exitReason: f.status === 'active' ? '' : f.exitReason,
      payBasis: f.payBasis, monthlySalary: toMinor(f.monthlySalary) || 0, projectRate: toMinor(f.projectRate) || 0,
      phone: f.phone, alternatePhone: f.alternatePhone, email: f.email, personalEmail: f.personalEmail,
      dateOfBirth: f.dateOfBirth || null, bloodGroup: f.bloodGroup, address: f.address, city: f.city, state: f.state, pincode: f.pincode,
      emergencyContact: { name: f.ecName, relation: f.ecRelation, phone: f.ecPhone },
      pan: f.pan, aadhaarLast4: f.aadhaarLast4, uan: f.uan,
      payoutDetails: { method: f.method, upiId: f.upiId, accountName: f.accountName, accountNumber: f.accountNumber, ifsc: f.ifsc, bankName: f.bankName },
      notes: f.notes,
    };
    try {
      const res = member ? await api.put(`/team/${member._id}`, body) : await api.post('/team', body);
      onDone(res.data.member);
    } catch (err) {
      const details = err.response?.data?.error?.details;
      if (details?.length) details.forEach((x) => setError(SERVER_PATHS[x.path] || x.path, { message: x.message }));
      else setError('root', { message: errorMessage(err) });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {e.root && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{e.root.message}</p>}

      <Section title="Role & employment">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={e.name?.message}><Input {...register('name')} /></Field>
          <Field label="Role / designation" error={e.role?.message}><Input {...register('role')} placeholder="UI Designer, Developer, SEO Executive…" /></Field>
          <Field label="Department" error={e.department?.message}><Input {...register('department')} placeholder="Design, Development, Marketing…" /></Field>
          <Field label="Type">
            <Select {...register('type')}><option value="employee">Employee</option><option value="freelancer">Freelancer</option></Select>
          </Field>
          <Field label="Joining date"><Input type="date" {...register('joiningDate')} /></Field>
          <Field label="Status" hint="People who have left can't be paid.">
            <Select {...register('status')}><option value="active">Active</option><option value="on_notice">On notice</option><option value="left">Left</option></Select>
          </Field>
          {status !== 'active' && (
            <>
              <Field label={status === 'left' ? 'Exit date' : 'Last working day'} error={e.exitDate?.message}><Input type="date" {...register('exitDate')} /></Field>
              <Field label="Reason" error={e.exitReason?.message}><Input {...register('exitReason')} /></Field>
            </>
          )}
        </div>
      </Section>

      <Section title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mobile" error={e.phone?.message}><Input type="tel" {...register('phone')} placeholder="+91 98765 43210" /></Field>
          <Field label="Alternate mobile" error={e.alternatePhone?.message}><Input type="tel" {...register('alternatePhone')} /></Field>
          <Field label="Work email" error={e.email?.message}><Input type="email" {...register('email')} /></Field>
          <Field label="Personal email" error={e.personalEmail?.message}><Input type="email" {...register('personalEmail')} /></Field>
        </div>
      </Section>

      <Section title="Personal & address">
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Date of birth" className="sm:col-span-3"><Input type="date" {...register('dateOfBirth')} /></Field>
          <Field label="Blood group" className="sm:col-span-3"><Select {...register('bloodGroup')}>{BLOOD.map((b) => <option key={b} value={b}>{b || '—'}</option>)}</Select></Field>
          <Field label="Address" className="sm:col-span-6"><Textarea rows={2} {...register('address')} /></Field>
          <Field label="City" className="sm:col-span-2"><Input {...register('city')} /></Field>
          <Field label="State" className="sm:col-span-2">
            <Select {...register('state')}><option value="">Choose</option>{INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}</Select>
          </Field>
          <Field label="PIN code" error={e.pincode?.message} className="sm:col-span-2"><Input inputMode="numeric" maxLength={6} {...register('pincode')} /></Field>
        </div>
      </Section>

      <Section title="Emergency contact">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" error={e.ecName?.message}><Input {...register('ecName')} /></Field>
          <Field label="Relation" error={e.ecRelation?.message}><Input {...register('ecRelation')} placeholder="Father, Spouse…" /></Field>
          <Field label="Mobile" error={e.ecPhone?.message}><Input type="tel" {...register('ecPhone')} /></Field>
        </div>
      </Section>

      <Section title="Pay & payout" hint="Pre-fills new payouts. Payslips show only the last 4 digits of the account.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Paid">
            <Select {...register('payBasis')}><option value="monthly">Monthly salary</option><option value="per_project">Per project</option></Select>
          </Field>
          {payBasis === 'monthly' ? (
            <Field label="Monthly salary" error={e.monthlySalary?.message}><MoneyInput {...register('monthlySalary')} /></Field>
          ) : (
            <Field label="Usual project rate" error={e.projectRate?.message}><MoneyInput {...register('projectRate')} /></Field>
          )}
          <Field label="Payout method"><Select {...register('method')}><option value="upi">UPI</option><option value="bank">Bank transfer</option></Select></Field>
          {method === 'upi' ? (
            <Field label="UPI ID" error={e.upiId?.message}><Input {...register('upiId')} placeholder="name@okhdfcbank" /></Field>
          ) : (
            <>
              <Field label="Account holder" error={e.accountName?.message}><Input {...register('accountName')} /></Field>
              <Field label="Bank" error={e.bankName?.message}><Input {...register('bankName')} /></Field>
              <Field label="Account number" error={e.accountNumber?.message}><Input className="font-mono uppercase" autoComplete="off" {...register('accountNumber')} /></Field>
              <Field label="IFSC" error={e.ifsc?.message}><Input className="font-mono uppercase" {...register('ifsc')} /></Field>
            </>
          )}
        </div>
      </Section>

      <Section title="Tax & statutory IDs" hint="For privacy only the last 4 digits of Aadhaar are stored.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="PAN" error={e.pan?.message}><Input className="font-mono uppercase" {...register('pan')} /></Field>
          <Field label="Aadhaar (last 4)" error={e.aadhaarLast4?.message}><Input inputMode="numeric" maxLength={4} className="font-mono" autoComplete="off" {...register('aadhaarLast4')} /></Field>
          <Field label="UAN (PF)" error={e.uan?.message}><Input inputMode="numeric" maxLength={12} className="font-mono" {...register('uan')} /></Field>
        </div>
      </Section>

      <Field label="Notes" error={e.notes?.message}><Textarea rows={2} {...register('notes')} /></Field>

      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={formState.isSubmitting}>{member ? 'Save' : 'Add team member'}</Button>
      </ModalFooter>
    </form>
  );
}
