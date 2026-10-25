// End-to-end API smoke test against an in-memory MongoDB. No Atlas needed.
//   npm run smoke -w server
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create();
Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: mongo.getUri('webx_smoke'),
  JWT_SECRET: 'smoke-test-secret-smoke-test-secret-123456',
  UPLOAD_DIR: '../node_modules/.cache/webx-smoke-uploads',
  SEED_OWNER_EMAIL: 'owner@smoke.test',
  SEED_OWNER_PASSWORD: 'SmokeOwner123',
});

const { connectDb, disconnectDb } = await import('../src/config/db.js');
const { createApp } = await import('../src/app.js');
const models = await import('../src/models/index.js');
const { runAs } = await import('../src/utils/context.js');
const { allocateNumber } = await import('../src/services/numbering.js');
const { closePdfBrowser } = await import('../src/services/pdf.js');

await connectDb(process.env.MONGODB_URI);
const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}/api`;

function client() {
  let cookie = '';
  return async (method, path, body, { form } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(cookie && { cookie }), ...(!form && body && { 'content-type': 'application/json' }) },
      body: form ?? (body ? JSON.stringify(body) : undefined),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data };
  };
}

let passed = 0;
async function step(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

try {
  // Seed the same way the seed script does.
  const owner = new models.User({ name: 'Owner', email: 'owner@smoke.test', role: 'owner' });
  await owner.setPassword('SmokeOwner123');
  await owner.save();
  await runAs(owner, async () => {
    await models.Settings.get();
    await new models.BankAccount({ kind: 'cash', label: 'Cash in hand', isSystem: true }).save();
    await new models.ExpenseCategory({ name: 'Travel' }).save();
  });

  const o = client();
  const a = client();

  await step('unauthenticated request is rejected', async () => {
    assert.equal((await o('GET', '/settings')).status, 401);
  });
  await step('wrong password rejected with generic message', async () => {
    const r = await o('POST', '/auth/login', { email: 'owner@smoke.test', password: 'nope' });
    assert.equal(r.status, 401);
    assert.equal(r.data.error.message, 'Invalid email or password');
  });
  await step('owner logs in, cookie is httpOnly', async () => {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'OWNER@smoke.test', password: 'SmokeOwner123' }) });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie'), /HttpOnly/i);
    const r = await o('POST', '/auth/login', { email: 'owner@smoke.test', password: 'SmokeOwner123' });
    assert.equal(r.data.user.role, 'owner');
    assert.equal(r.data.user.passwordHash, undefined);
  });
  await step('settings have company defaults', async () => {
    const r = await o('GET', '/settings');
    assert.equal(r.data.settings.company.name, 'The Web{X} Studio');
    assert.equal(r.data.settings.invoiceDefaults.advancePercent, 30);
    assert.equal(r.data.settings.numbering.invoice.padding, 4);
  });
  await step('company update validates GSTIN', async () => {
    const bad = await o('PUT', '/settings/company', { name: 'X', gstin: 'nope' });
    assert.equal(bad.status, 400);
    assert.equal(bad.data.error.details[0].path, 'gstin');
    const ok = await o('PUT', '/settings/company', { name: 'The Web{X} Studio', phones: ['+91 79733 86875'], gstin: '03abcde1234f1z5' });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.settings.company.gstin, '03ABCDE1234F1Z5');
  });
  await step('bank account create, first becomes default, IFSC validated', async () => {
    const bad = await o('POST', '/bank-accounts', { label: 'HDFC', bankName: 'HDFC', ifsc: 'bad' });
    assert.equal(bad.status, 400);
    const r1 = await o('POST', '/bank-accounts', { label: 'HDFC Current', payableTo: 'The Web{X} Studio', bankName: 'HDFC Bank', ifsc: 'hdfc0001234', accountNumber: '50100012345678', openingBalance: 1500000 });
    assert.equal(r1.status, 201);
    assert.equal(r1.data.account.isDefault, true);
    assert.equal(r1.data.account.ifsc, 'HDFC0001234');
    const r2 = await o('POST', '/bank-accounts', { label: 'ICICI', bankName: 'ICICI', upiId: 'webx@icici', isDefault: true });
    const list = await o('GET', '/bank-accounts');
    const defaults = list.data.items.filter((x) => x.isDefault);
    assert.equal(defaults.length, 1);
    assert.equal(defaults[0]._id, r2.data.account._id);
  });
  await step('non-integer money is rejected', async () => {
    const r = await o('POST', '/bank-accounts', { label: 'X', bankName: 'X', openingBalance: 10.5 });
    assert.equal(r.status, 400);
  });
  await step('cash system account cannot be deactivated', async () => {
    const list = await o('GET', '/bank-accounts');
    const cash = list.data.items.find((x) => x.kind === 'cash');
    assert.equal((await o('POST', `/bank-accounts/${cash._id}/deactivate`)).status, 400);
    assert.equal((await o('POST', `/bank-accounts/${cash._id}/default`)).status, 400);
  });
  await step('numbering resets per financial year', async () => {
    await runAs(owner, async () => {
      const a1 = await allocateNumber('invoice', new Date('2026-09-29'));
      const a2 = await allocateNumber('invoice', new Date('2027-03-31'));
      const b1 = await allocateNumber('invoice', new Date('2027-04-01'));
      assert.equal(a1.number, '2026-27/0001');
      assert.equal(a2.number, '2026-27/0002');
      assert.equal(b1.number, '2027-28/0001');
    });
  });
  await step('numbering preview + set next, cannot move backwards', async () => {
    const set = await o('POST', '/settings/numbering/next', { type: 'invoice', fy: '2026-27', next: 903 });
    assert.equal(set.status, 200);
    const p = await o('GET', '/settings/numbering/preview?date=2026-10-10');
    assert.equal(p.data.next.invoice.number, '2026-27/0903');
    assert.equal(p.data.next.receipt.number, 'RCPT-2026-27/0001');
    const back = await o('POST', '/settings/numbering/next', { type: 'invoice', fy: '2026-27', next: 900 });
    assert.equal(back.status, 409);
  });
  await step('numbering allocation is race-safe (50 parallel)', async () => {
    const nums = await runAs(owner, () => Promise.all(Array.from({ length: 50 }, () => allocateNumber('receipt', new Date('2026-10-10')))));
    assert.equal(new Set(nums.map((n) => n.number)).size, 50);
  });
  await step('numbering format change', async () => {
    const s = (await o('GET', '/settings')).data.settings.numbering;
    s.invoice = { prefix: 'WX-', padding: 4, includeFy: true, separator: '/' };
    assert.equal((await o('PUT', '/settings/numbering', s)).status, 200);
    const p = await o('GET', '/settings/numbering/preview?date=2026-10-10');
    assert.equal(p.data.next.invoice.number, 'WX-2026-27/0903');
  });
  await step('logo upload checks real file content', async () => {
    const fake = new FormData();
    fake.append('logo', new Blob(['not a png'], { type: 'image/png' }), 'logo.png');
    assert.equal((await o('POST', '/settings/logo', null, { form: fake })).status, 400);
    const svg = new FormData();
    svg.append('logo', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], { type: 'image/svg+xml' }), 'logo.svg');
    const r = await o('POST', '/settings/logo', null, { form: svg });
    assert.equal(r.status, 200);
    const logo = await fetch(base + '/settings/logo', { headers: { cookie: '' } });
    assert.equal(logo.status, 401);
  });
  await step('owner creates accountant; accountant cannot change settings', async () => {
    const weak = await o('POST', '/users', { name: 'Acc', email: 'acc@smoke.test', role: 'accountant', password: 'short' });
    assert.equal(weak.status, 400);
    const r = await o('POST', '/users', { name: 'Acc', email: 'acc@smoke.test', role: 'accountant', password: 'Accountant123' });
    assert.equal(r.status, 201);
    assert.equal((await a('POST', '/auth/login', { email: 'acc@smoke.test', password: 'Accountant123' })).status, 200);
    assert.equal((await a('GET', '/settings')).status, 200);
    assert.equal((await a('GET', '/bank-accounts')).status, 200);
    assert.equal((await a('PUT', '/settings/company', { name: 'Hacked' })).status, 403);
    assert.equal((await a('POST', '/bank-accounts', { label: 'X', bankName: 'X' })).status, 403);
    assert.equal((await a('GET', '/users')).status, 403);
    assert.equal((await a('GET', '/audit-logs')).status, 403);
  });
  await step('owner cannot demote themselves', async () => {
    const me = (await o('GET', '/auth/me')).data.user;
    assert.equal((await o('PUT', `/users/${me._id}`, { name: me.name, role: 'accountant', isActive: true })).status, 400);
  });
  await step('deactivating a user kills their session', async () => {
    const users = (await o('GET', '/users')).data.items;
    const acc = users.find((u) => u.email === 'acc@smoke.test');
    await o('PUT', `/users/${acc._id}`, { name: 'Acc', role: 'accountant', isActive: false });
    assert.equal((await a('GET', '/settings')).status, 401);
  });
  await step('password change invalidates old sessions', async () => {
    const other = client();
    await other('POST', '/auth/login', { email: 'owner@smoke.test', password: 'SmokeOwner123' });
    const r = await o('POST', '/auth/change-password', { currentPassword: 'SmokeOwner123', newPassword: 'SmokeOwner456' });
    assert.equal(r.status, 200);
    assert.equal((await other('GET', '/auth/me')).status, 401);
    assert.equal((await o('GET', '/auth/me')).status, 200);
  });
  await step('audit log records who changed what', async () => {
    const r = await o('GET', '/audit-logs?entity=Settings&limit=50');
    const companyChange = r.data.items.find((x) => x.changes.some((c) => c.path === 'company.gstin'));
    assert.ok(companyChange, 'expected company.gstin change in audit log');
    assert.equal(companyChange.actorName, 'Owner');
    const logins = await o('GET', '/audit-logs?action=login');
    assert.ok(logins.data.total >= 2);
  });
  await step('audit log is append-only', async () => {
    await assert.rejects(models.AuditLog.deleteMany({}));
  });
  await step('pagination + search on users', async () => {
    const r = await o('GET', '/users?search=acc&limit=1');
    assert.equal(r.data.total, 1);
    assert.equal(r.data.limit, 1);
  });
  // ── Phase 2: clients + invoices ───────────────────────
  const o2 = client();
  await o2('POST', '/auth/login', { email: 'owner@smoke.test', password: 'SmokeOwner456' });
  let bankId;
  let clientId;
  let advInv;
  await step('client create + validation', async () => {
    assert.equal((await o2('POST', '/clients', { name: '' })).status, 400);
    const r = await o2('POST', '/clients', { name: 'GS Associates', secondaryName: 'Gurpreet Singh & Associates', state: 'Punjab', gstin: '03aaaca1234a1z2' });
    assert.equal(r.status, 201);
    clientId = r.data.client._id;
    bankId = (await o2('GET', '/bank-accounts')).data.items.find((b) => b.label === 'HDFC Current')._id;
  });
  await step('advance invoice: totals, note, number computed on server', async () => {
    const r = await o2('POST', '/invoices', {
      client: clientId, issueDate: '2026-09-29', dueText: 'On receipt (advance)', currency: 'INR',
      items: [{ title: 'Website Design & Development', description: 'Complete custom website', qty: 1, rate: 1500000 }],
      split: { type: 'advance', advanceBy: 'percent', advanceValue: 30 }, bankAccount: bankId,
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    advInv = r.data.invoice;
    assert.equal(advInv.number, undefined, 'drafts are unnumbered');
    assert.equal(advInv.total, 1500000);
    assert.equal(advInv.split.advanceAmount, 450000);
    assert.equal(advInv.split.balanceAmount, 1050000);
    assert.equal(advInv.note, '30% advance (₹4,500) is payable to commence work. The remaining balance of ₹10,500 is due on completion, before final delivery.');
    assert.equal(advInv.snapshot.client.name, 'GS Associates');
    assert.equal(advInv.snapshot.bank.ifsc, 'HDFC0001234');
    assert.equal(advInv.status, 'draft');
    const sent = await o2('POST', `/invoices/${advInv._id}/send`);
    assert.equal(sent.data.invoice.number, 'WX-2026-27/0903', 'number given on finalise');
    assert.equal(sent.data.invoice.status, 'sent');
    advInv = sent.data.invoice;
  });
  await step('drafts do not consume invoice numbers', async () => {
    const before = (await o2('GET', '/invoices/next-number?date=2026-10-04')).data.number;
    const d = await o2('POST', '/invoices', { client: clientId, issueDate: '2026-10-04', items: [{ title: 'Draft only', qty: 1, rate: 100 }], split: { type: 'full' } });
    assert.equal(d.data.invoice.number, undefined);
    assert.equal((await o2('GET', '/invoices/next-number?date=2026-10-04')).data.number, before);
    const ok = await o2('POST', `/invoices/${d.data.invoice._id}/cancel`, { reason: 'Never sent' });
    assert.equal(ok.data.invoice.status, 'cancelled');
    assert.equal((await o2('GET', '/invoices/next-number?date=2026-10-04')).data.number, before, 'cancelling a draft leaves no gap');
  });
  await step('inline new client is saved; amount advance + discount', async () => {
    const r = await o2('POST', '/invoices', {
      newClient: { name: 'Inline Co', country: 'India' }, issueDate: '2026-10-01', currency: 'INR',
      items: [{ title: 'Logo', qty: 2, rate: 500000 }],
      discount: { type: 'percent', value: 10 },
      split: { type: 'advance', advanceBy: 'amount', advanceValue: 300000 },
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.invoice.total, 900000);
    assert.equal(r.data.invoice.split.balanceAmount, 600000);
    assert.match(r.data.invoice.note, /^An advance of ₹3,000/);
    const clients = await o2('GET', '/clients?search=Inline');
    assert.equal(clients.data.total, 1);
  });
  await step('GST: CGST+SGST same state, IGST other state', async () => {
    const s = (await o2('GET', '/settings')).data.settings;
    await o2('PUT', '/settings/preferences', { baseCurrency: 'INR', gst: { enabled: true, defaultRate: 18 }, invoiceDefaults: s.invoiceDefaults });
    await o2('PUT', '/settings/company', { name: 'The Web{X} Studio', state: 'Punjab', stateCode: '03' });
    const same = await o2('POST', '/invoices', { client: clientId, issueDate: '2026-10-02', items: [{ title: 'A', qty: 1, rate: 1000000 }], gstEnabled: true, split: { type: 'full' } });
    assert.equal(same.data.invoice.gst.cgst, 90000);
    assert.equal(same.data.invoice.gst.sgst, 90000);
    assert.equal(same.data.invoice.total, 1180000);
    const other = await o2('POST', '/invoices', { newClient: { name: 'Delhi Ltd', state: 'Delhi' }, issueDate: '2026-10-02', items: [{ title: 'A', qty: 1, rate: 1000000 }], gstEnabled: true, split: { type: 'full' } });
    assert.equal(other.data.invoice.gst.mode, 'inter');
    assert.equal(other.data.invoice.gst.igst, 180000);
  });
  await step('foreign currency converts to INR', async () => {
    const r = await o2('POST', '/invoices', { client: clientId, issueDate: '2026-10-03', currency: 'USD', exchangeRate: 83.5, items: [{ title: 'A', qty: 1, rate: 100000 }], split: { type: 'full' } });
    assert.equal(r.data.invoice.totalInr, 8350000);
  });
  await step('manual number: unique, bumps the series', async () => {
    const dup = await o2('POST', '/invoices', { client: clientId, number: advInv.number, issueDate: '2026-10-04', items: [{ title: 'A', qty: 1, rate: 100 }], split: { type: 'full' } });
    assert.equal(dup.status, 409);
    const man = await o2('POST', '/invoices', { client: clientId, number: 'WX-2026-27/0950', issueDate: '2026-10-04', items: [{ title: 'A', qty: 1, rate: 100 }], split: { type: 'full' } });
    assert.equal(man.status, 201);
    const next = await o2('GET', '/invoices/next-number?date=2026-10-04');
    assert.equal(next.data.number, 'WX-2026-27/0951');
  });
  await step('validation errors do not consume numbers', async () => {
    const before = (await o2('GET', '/invoices/next-number?date=2026-10-04')).data.number;
    const bad = await o2('POST', '/invoices', { client: '0123456789abcdef01234567', issueDate: '2026-10-04', items: [{ title: 'A', qty: 1, rate: 100 }], split: { type: 'full' } });
    assert.equal(bad.status, 400);
    assert.equal((await o2('GET', '/invoices/next-number?date=2026-10-04')).data.number, before);
  });
  await step('edit keeps number; finalising a draft; duplicate is an unnumbered draft', async () => {
    const up = await o2('PUT', `/invoices/${advInv._id}`, {
      client: clientId, issueDate: '2026-09-29', dueText: 'On receipt (advance)', currency: 'INR',
      items: [{ title: 'Website Design & Development', qty: 1, rate: 2000000 }],
      split: { type: 'advance', advanceBy: 'percent', advanceValue: 30 }, bankAccount: bankId,
    });
    assert.equal(up.status, 200, JSON.stringify(up.data));
    assert.equal(up.data.invoice.split.advanceAmount, 600000);
    assert.equal(up.data.invoice.number, advInv.number);
    assert.equal((await o2('POST', `/invoices/${advInv._id}/send`)).status, 409, 'already sent');
    const dupl = await o2('POST', `/invoices/${advInv._id}/duplicate`);
    assert.equal(dupl.status, 201);
    assert.equal(dupl.data.invoice.number, undefined);
    assert.equal(dupl.data.invoice.status, 'draft');
    const expected = (await o2('GET', '/invoices/next-number?date=2026-10-11')).data.number;
    const fin = await o2('PUT', `/invoices/${dupl.data.invoice._id}`, { client: clientId, issueDate: '2026-10-11', items: [{ title: 'Copy', qty: 1, rate: 100 }], split: { type: 'full' }, status: 'sent' });
    assert.equal(fin.data.invoice.number, expected, 'save & mark sent numbers a draft');
    assert.equal((await o2('POST', `/invoices/${advInv._id}/balance-invoice`)).status, 404, 'balance invoices removed: one invoice tracks all payments');
  });
  await step('PDF download', async () => {
    const res = await fetch(`${base}/invoices/${advInv._id}/pdf?download=1`, { headers: { cookie: (await (async () => { const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@smoke.test', password: 'SmokeOwner456' }) }); return r.headers.get('set-cookie').split(';')[0]; })()) } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition'), /attachment; filename="Invoice-WX-2026-27-0903-GS-Associates\.pdf"/);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  });
  await step('paid invoices are locked; status from payments', async () => {
    await runAs(owner, async () => {
      const inv = await models.Invoice.findById(advInv._id);
      inv.amountPaid = inv.total;
      const { applyPaymentState } = await import('../src/services/invoices.js');
      applyPaymentState(inv);
      await inv.save();
      assert.equal(inv.status, 'paid');
      assert.equal(inv.balanceDue, 0);
    });
    const r = await o2('PUT', `/invoices/${advInv._id}`, { client: clientId, issueDate: '2026-09-29', items: [{ title: 'X', qty: 1, rate: 1 }], split: { type: 'full' } });
    assert.equal(r.status, 409);
  });
  await step('overdue derived from due date; list filters', async () => {
    const r = await o2('POST', '/invoices', { client: clientId, issueDate: '2026-01-01', dueDate: '2026-01-15', items: [{ title: 'Old', qty: 1, rate: 100000 }], split: { type: 'full' }, status: 'sent' });
    assert.equal(r.data.invoice.displayStatus, 'overdue');
    const list = await o2('GET', '/invoices?status=overdue');
    assert.ok(list.data.items.some((i) => i._id === r.data.invoice._id));
    const search = await o2('GET', '/invoices?search=0903');
    assert.equal(search.data.total, 1);
  });
  await step('cancel: owner only, reason required, number kept', async () => {
    const d = await o2('POST', '/invoices', { client: clientId, issueDate: '2026-10-05', items: [{ title: 'C', qty: 1, rate: 100 }], split: { type: 'full' }, status: 'sent' });
    assert.equal((await o2('POST', `/invoices/${d.data.invoice._id}/cancel`, { reason: '' })).status, 400);
    const c = await o2('POST', `/invoices/${d.data.invoice._id}/cancel`, { reason: 'Client changed scope' });
    assert.equal(c.data.invoice.status, 'cancelled');
    assert.equal((await o2('GET', `/invoices?search=${encodeURIComponent(d.data.invoice.number)}`)).data.total, 1);
  });
  await step('client stats: billed, received, outstanding', async () => {
    const r = await o2('GET', `/clients/${clientId}`);
    const s = r.data.client.stats;
    assert.ok(s.billedInr > 0);
    assert.equal(s.receivedInr, 2000000);
    assert.ok(s.outstandingInr > 0);
  });
  await step('invoice changes are audited', async () => {
    const r = await o2('GET', `/audit-logs?entity=Invoice&entityId=${advInv._id}&limit=50`);
    assert.ok(r.data.items.some((x) => x.action === 'status'));
    assert.ok(r.data.items.some((x) => x.changes.some((c) => c.path === 'total')));
  });
  // ── Phase 3: payments + receipts ──────────────────────
  let payInv;
  let p1;
  await step('payment on a draft: partial, receipt number, draft becomes sent', async () => {
    const r = await o2('POST', '/invoices', { client: clientId, issueDate: '2026-10-06', items: [{ title: 'Branding', qty: 1, rate: 1000000 }], split: { type: 'advance', advanceBy: 'percent', advanceValue: 30 }, bankAccount: bankId });
    payInv = r.data.invoice;
    assert.equal(payInv.status, 'draft');
    const pay = await o2('POST', '/payments', { invoice: payInv._id, date: '2026-10-07', amount: 300000, mode: 'upi', reference: 'UTR123' });
    assert.equal(pay.status, 201, JSON.stringify(pay.data));
    p1 = pay.data.payment;
    assert.match(p1.receiptNumber, /^RCPT-2026-27\/\d{4}$/);
    assert.equal(p1.purpose, 'advance');
    assert.match(p1.invoiceNumber, /^WX-2026-27\/\d{4}$/, 'receiving money finalises and numbers a draft');
    assert.equal(p1.previouslyReceived, 0);
    assert.equal(p1.balanceAfter, 700000);
    assert.equal(pay.data.invoice.status, 'partly_paid');
    assert.equal(pay.data.invoice.balanceDue, 700000);
    assert.equal(p1.snapshot.bank.bankName, 'HDFC Bank');
  });
  await step('overpayment is rejected', async () => {
    const r = await o2('POST', '/payments', { invoice: payInv._id, date: '2026-10-08', amount: 700001, mode: 'upi' });
    assert.equal(r.status, 400);
    assert.equal(r.data.error.details[0].path, 'amount');
  });
  let p2;
  await step('final payment with TDS + proof upload (multipart) settles invoice', async () => {
    const fd = new FormData();
    fd.append('data', JSON.stringify({ invoice: payInv._id, date: '2026-10-09', amount: 630000, tds: 70000, mode: 'bank_transfer', reference: 'NEFT987' }));
    fd.append('proof', new Blob([Buffer.from('%PDF-1.4 test')], { type: 'application/pdf' }), 'proof.pdf');
    const r = await o2('POST', '/payments', null, { form: fd });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    p2 = r.data.payment;
    assert.equal(p2.purpose, 'final');
    assert.equal(p2.invoiceNumber, p1.invoiceNumber, 'advance and final payment reference the same invoice');
    assert.equal(p2.previouslyReceived, 300000);
    assert.equal(p2.balanceAfter, 0);
    assert.ok(p2.proof.key.startsWith('payment-proofs/'));
    assert.equal(r.data.invoice.status, 'paid');
    assert.equal(r.data.invoice.tdsAmount, 70000);
    assert.equal(r.data.invoice.balanceDue, 0);
    const proof = await o2('GET', `/files/${p2.proof.key}`);
    assert.equal(proof.status, 200);
  });
  await step('paid invoice rejects more payments and edits', async () => {
    assert.equal((await o2('POST', '/payments', { invoice: payInv._id, date: '2026-10-09', amount: 1, mode: 'cash' })).status, 409);
  });
  await step('cash payment defaults to the cash account', async () => {
    const r = await o2('POST', '/invoices', { client: clientId, issueDate: '2026-10-06', items: [{ title: 'Cash job', qty: 1, rate: 50000 }], split: { type: 'full' }, status: 'sent' });
    const pay = await o2('POST', '/payments', { invoice: r.data.invoice._id, date: '2026-10-07', amount: 50000, mode: 'cash' });
    assert.equal(pay.data.payment.snapshot.bank.kind, 'cash');
  });
  await step('receipt PDF', async () => {
    const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@smoke.test', password: 'SmokeOwner456' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const res = await fetch(`${base}/payments/${p2._id}/receipt?download=1`, { headers: { cookie } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition'), /Receipt-RCPT-2026-27-\d{4}-GS-Associates\.pdf/);
    assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  });
  await step('accountant cannot void; owner void reopens invoice', async () => {
    const acc = client();
    await o2('POST', '/users', { name: 'Acc2', email: 'acc2@smoke.test', role: 'accountant', password: 'Accountant123' });
    await acc('POST', '/auth/login', { email: 'acc2@smoke.test', password: 'Accountant123' });
    assert.equal((await acc('POST', `/payments/${p2._id}/void`, { reason: 'Bounced' })).status, 403);
    assert.equal((await acc('POST', '/payments', { invoice: payInv._id, date: '2026-10-09', amount: 1, mode: 'cash' })).status, 409);
    const v = await o2('POST', `/payments/${p2._id}/void`, { reason: 'Cheque bounced' });
    assert.equal(v.status, 200);
    assert.equal(v.data.invoice.status, 'partly_paid');
    assert.equal(v.data.invoice.balanceDue, 700000);
    assert.equal((await o2('POST', `/payments/${p2._id}/void`, { reason: 'again' })).status, 409);
  });
  await step('invoice with payments cannot be cancelled', async () => {
    assert.equal((await o2('POST', `/invoices/${payInv._id}/cancel`, { reason: 'test' })).status, 409);
  });
  await step('payments list: filters, search, summary', async () => {
    const all = await o2('GET', `/payments?invoice=${payInv._id}`);
    assert.equal(all.data.total, 2);
    assert.equal(all.data.summary.count, 1);
    assert.equal(all.data.summary.amountInr, 300000);
    const s = await o2('GET', '/payments?search=UTR123');
    assert.equal(s.data.total, 1);
    const v = await o2('GET', '/payments?status=void');
    assert.equal(v.data.total, 1);
  });
  // ── Phase 4: expenses, reimbursements, team, payouts ──
  let catId;
  let cashId;
  let exp1;
  await step('expense: voucher number, lines total, bills upload, validation', async () => {
    catId = (await o2('GET', '/expense-categories')).data.items[0]._id;
    cashId = (await o2('GET', '/bank-accounts')).data.items.find((b) => b.kind === 'cash')._id;
    const bad = await o2('POST', '/expenses', { date: '2026-10-05', category: catId, vendor: '', lines: [{ description: 'x', amount: 0 }], mode: 'upi', paidFrom: bankId });
    assert.equal(bad.status, 400);
    const fd = new FormData();
    fd.append('data', JSON.stringify({ date: '2026-10-05', category: catId, vendor: 'Figma', description: 'Design tool', lines: [{ description: 'Pro plan', amount: 120000 }, { description: 'GST', amount: 21600 }], mode: 'card', paidFrom: bankId, recurring: { enabled: true, interval: 'monthly' } }));
    fd.append('bills', new Blob([Buffer.from('%PDF-1.4 bill')], { type: 'application/pdf' }), 'bill.pdf');
    const r = await o2('POST', '/expenses', null, { form: fd });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    exp1 = r.data.expense;
    assert.match(exp1.voucherNumber, /^VCH-2026-27\/\d{4}$/);
    assert.equal(exp1.amount, 141600);
    assert.equal(exp1.bills.length, 1);
    assert.equal(exp1.recurring.nextDueDate.slice(0, 10), '2026-11-05');
  });
  await step('expense edit keeps/removes bills; recurring record-next', async () => {
    const up = await o2('PUT', `/expenses/${exp1._id}`, { date: '2026-10-05', category: catId, vendor: 'Figma', lines: [{ description: 'Pro plan', amount: 150000 }], mode: 'card', paidFrom: bankId, recurring: { enabled: true, interval: 'monthly' }, keepBills: [] });
    assert.equal(up.status, 200, JSON.stringify(up.data));
    assert.equal(up.data.expense.amount, 150000);
    assert.equal(up.data.expense.bills.length, 0);
    assert.equal(up.data.expense.voucherNumber, exp1.voucherNumber);
    const next = await o2('POST', `/expenses/${exp1._id}/record-next`);
    assert.equal(next.status, 201);
    assert.equal(next.data.expense.date.slice(0, 10), '2026-11-05');
    assert.equal(next.data.expense.recurringSource, exp1._id);
    const src = await o2('GET', `/expenses/${exp1._id}`);
    assert.equal(src.data.expense.recurring.nextDueDate.slice(0, 10), '2026-12-05');
  });
  await step('month-end recurring clamps (31 Jan → 28 Feb)', async () => {
    const { addInterval } = await import('../src/services/expenses.js');
    assert.equal(addInterval(new Date('2027-01-31T00:00:00Z'), 'monthly').toISOString().slice(0, 10), '2027-02-28');
  });
  await step('expense voucher PDF + list summary + void', async () => {
    const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@smoke.test', password: 'SmokeOwner456' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const pdf = await fetch(`${base}/expenses/${exp1._id}/voucher`, { headers: { cookie } });
    assert.equal(pdf.status, 200);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    const list = await o2('GET', '/expenses');
    assert.equal(list.data.summary.amount, 300000);
    assert.equal((await o2('POST', `/expenses/${exp1._id}/void`, { reason: 'Duplicate entry' })).data.expense.status, 'void');
    assert.equal((await o2('GET', '/expenses')).data.summary.amount, 150000);
    assert.equal((await o2('PUT', `/expenses/${exp1._id}`, { date: '2026-10-05', category: catId, vendor: 'X', lines: [{ amount: 1 }], mode: 'card', paidFrom: bankId })).status, 409);
  });
  let memberId;
  await step('team member create + validation', async () => {
    assert.equal((await o2('POST', '/team', { name: 'Riya', type: 'freelancer', payBasis: 'per_project', payoutDetails: { method: 'upi', upiId: 'bad' } })).status, 400);
    const r = await o2('POST', '/team', { name: 'Riya Sharma', role: 'UI Designer', type: 'employee', payBasis: 'monthly', monthlySalary: 3000000, payoutDetails: { method: 'bank', accountNumber: '123456789012', ifsc: 'hdfc0001234', bankName: 'HDFC' } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    memberId = r.data.member._id;
  });
  let reimbId;
  await step('reimbursement: submitted → approved → reimbursed, voucher on reimburse', async () => {
    const r = await o2('POST', '/reimbursements', { date: '2026-10-03', category: catId, vendor: 'Uber', lines: [{ description: 'Client meeting cab', amount: 45000 }], payeeType: 'member', member: memberId });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    reimbId = r.data.reimbursement._id;
    assert.equal(r.data.reimbursement.reimbursement.status, 'submitted');
    assert.equal(r.data.reimbursement.reimbursement.payeeName, 'Riya Sharma');
    assert.equal(r.data.reimbursement.voucherNumber, undefined);
    assert.equal((await o2('POST', `/reimbursements/${reimbId}/reimburse`, { date: '2026-10-04', paidFrom: bankId, mode: 'upi' })).status, 409);
    const acc = client();
    await acc('POST', '/auth/login', { email: 'acc2@smoke.test', password: 'Accountant123' });
    assert.equal((await acc('POST', `/reimbursements/${reimbId}/approve`)).status, 403);
    assert.equal((await o2('POST', `/reimbursements/${reimbId}/approve`)).data.reimbursement.reimbursement.status, 'approved');
    assert.equal((await o2('PUT', `/reimbursements/${reimbId}`, { date: '2026-10-03', category: catId, lines: [{ amount: 1 }], payeeType: 'owner' })).status, 409);
    const paid = await acc('POST', `/reimbursements/${reimbId}/reimburse`, { date: '2026-10-04', paidFrom: bankId, mode: 'upi', reference: 'UPI55' });
    assert.equal(paid.status, 200, JSON.stringify(paid.data));
    assert.equal(paid.data.reimbursement.reimbursement.status, 'reimbursed');
    assert.match(paid.data.reimbursement.voucherNumber, /^VCH-2026-27\/\d{4}$/);
    const pending = await o2('GET', '/reimbursements?reimbursementStatus=pending');
    assert.equal(pending.data.total, 0);
    assert.equal((await o2('GET', '/expenses')).data.items.some((x) => x._id === reimbId), false);
  });
  await step('reimbursement reject; owner payee defaults to user name', async () => {
    const r = await o2('POST', '/reimbursements', { date: '2026-10-03', category: catId, lines: [{ description: 'Domain', amount: 99900 }], payeeType: 'owner' });
    assert.equal(r.data.reimbursement.reimbursement.payeeName, 'Owner');
    const rej = await o2('POST', `/reimbursements/${r.data.reimbursement._id}/reject`, { reason: 'Personal' });
    assert.equal(rej.data.reimbursement.reimbursement.status, 'rejected');
  });
  let payoutId;
  await step('payout: totals, payslip number, PDF, stats, void', async () => {
    const bad = await o2('POST', '/payouts', { member: memberId, date: '2026-10-01', periodLabel: 'September 2026', earnings: [{ label: 'Salary', amount: 100 }], deductions: [{ label: 'Advance', amount: 200 }], mode: 'bank_transfer', paidFrom: bankId });
    assert.equal(bad.status, 400);
    const r = await o2('POST', '/payouts', { member: memberId, date: '2026-10-01', periodLabel: 'September 2026', earnings: [{ label: 'Monthly salary', amount: 3000000 }], bonus: 500000, deductions: [{ label: 'TDS', amount: 300000 }], mode: 'bank_transfer', reference: 'NEFT1', paidFrom: bankId });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    payoutId = r.data.payout._id;
    assert.equal(r.data.payout.net, 3200000);
    assert.match(r.data.payout.voucherNumber, /^PAY-2026-27\/\d{4}$/);
    assert.equal(r.data.payout.snapshot.member.payoutDetails.ifsc, 'HDFC0001234');
    const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@smoke.test', password: 'SmokeOwner456' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const pdf = await fetch(`${base}/payouts/${payoutId}/payslip?download=1`, { headers: { cookie } });
    assert.match(pdf.headers.get('content-disposition'), /Payslip-PAY-2026-27-\d{4}-Riya-Sharma\.pdf/);
    const m = await o2('GET', `/team/${memberId}`);
    assert.equal(m.data.member.stats.totalNet, 3200000);
    assert.equal((await o2('POST', `/payouts/${payoutId}/void`, { reason: 'Wrong month' })).data.payout.status, 'void');
    assert.equal((await o2('GET', `/team/${memberId}`)).data.member.stats.totalNet, 0);
  });
  await step('inactive member cannot be paid', async () => {
    await o2('POST', `/team/${memberId}/deactivate`);
    const r = await o2('POST', '/payouts', { member: memberId, date: '2026-10-01', project: 'Site', earnings: [{ label: 'Fee', amount: 100 }], mode: 'upi', paidFrom: cashId });
    assert.equal(r.status, 400);
  });
  // ── Phase 5: ledger, reports, dashboard, exports ──────
  const balanceOf = async (id) => (await o2('GET', '/ledger/balances')).data.items.find((a) => a._id === id).balance;
  await step('ledger: account running balance matches balances endpoint', async () => {
    const page = await o2('GET', `/ledger?account=${bankId}&limit=500`);
    assert.equal(page.status, 200, JSON.stringify(page.data));
    assert.equal(page.data.openingBalance, 1500000);
    assert.equal(page.data.closingBalance, await balanceOf(bankId));
    const newest = page.data.items[0];
    assert.equal(newest.balance, page.data.closingBalance);
    assert.ok(page.data.items.some((r) => r.type === 'reimbursement' && r.amount === 45000));
    assert.ok(page.data.items.every((r) => r.sourceModel !== 'Payout'), 'voided payout must not appear');
  });
  await step('ledger: from-date opening includes earlier rows', async () => {
    const all = await o2('GET', `/ledger?account=${bankId}&limit=500`);
    const later = await o2('GET', `/ledger?account=${bankId}&from=2026-10-08&limit=500`);
    assert.equal(later.data.closingBalance, all.data.closingBalance);
    assert.ok(later.data.total < all.data.total);
  });
  await step('manual entries: transfer moves money, owner investment adds, P&L unchanged', async () => {
    const pnlBefore = (await o2('GET', '/reports/pnl?fy=2026-27')).data.totals;
    const b0 = await balanceOf(bankId);
    const c0 = await balanceOf(cashId);
    assert.equal((await o2('POST', '/ledger/entries', { type: 'transfer', date: '2026-10-10', amount: 100000, account: bankId, toAccount: bankId })).status, 400);
    const t = await o2('POST', '/ledger/entries', { type: 'transfer', date: '2026-10-10', amount: 100000, account: bankId, toAccount: cashId, description: 'ATM' });
    assert.equal(t.status, 201, JSON.stringify(t.data));
    await o2('POST', '/ledger/entries', { type: 'owner_investment', date: '2026-10-10', amount: 5000000, account: bankId });
    assert.equal(await balanceOf(bankId), b0 - 100000 + 5000000);
    assert.equal(await balanceOf(cashId), c0 + 100000);
    assert.deepEqual((await o2('GET', '/reports/pnl?fy=2026-27')).data.totals, pnlBefore);
    const v = await o2('POST', `/ledger/entries/${t.data.entry._id}/void`, { reason: 'Test' });
    assert.equal(v.status, 200);
    assert.equal(await balanceOf(cashId), c0);
  });
  await step('P&L income = payments + TDS; expenses = expenses + reimbursements + payouts', async () => {
    const pnl = (await o2('GET', '/reports/pnl?fy=2026-27')).data;
    const pays = (await o2('GET', '/payments?status=active&limit=1')).data.summary;
    assert.equal(pnl.totals.income, pays.amountInr + pays.tdsInr);
    const exp = (await o2('GET', '/expenses?status=active&limit=1')).data.summary.amount;
    const reimb = (await o2('GET', '/reimbursements?reimbursementStatus=reimbursed&status=active&limit=1')).data.summary.amount;
    const pay = (await o2('GET', '/payouts?status=active&limit=1')).data.summary.net;
    assert.equal(pnl.totals.expenses, exp + reimb + pay);
    assert.equal(pnl.months.length, 12);
    assert.equal(pnl.months[0].label, 'Apr 26');
    const byFy = (await o2('GET', '/reports/pnl-fy')).data.rows;
    assert.ok(byFy.some((r) => r.fy === '2026-27'));
  });
  await step('category and client reports add up', async () => {
    const cat = (await o2('GET', '/reports/expense-by-category')).data;
    assert.equal(cat.rows.reduce((t, r) => t + r.amount, 0), cat.total);
    const inc = (await o2('GET', '/reports/income-by-client')).data;
    assert.equal(inc.rows.reduce((t, r) => t + r.total, 0), inc.total);
  });
  await step('receivables ageing totals = client outstanding', async () => {
    const rec = (await o2('GET', '/reports/receivables')).data;
    const sumBuckets = rec.buckets.reduce((t, b) => t + rec.totals[b.key], 0);
    assert.equal(sumBuckets, rec.totals.total);
    const clientsList = (await o2('GET', '/clients?archived=all&limit=200')).data.items;
    assert.equal(rec.totals.total, clientsList.reduce((t, c) => t + c.stats.outstandingInr, 0));
    assert.ok(rec.invoices.some((i) => i.daysOverdue > 200), 'the January invoice should be 90+ days overdue');
  });
  await step('GST summary picks up GST invoices', async () => {
    const before = (await o2('GET', '/reports/gst?from=2026-10-01&to=2026-10-31')).data.totals;
    await o2('POST', '/invoices', { client: clientId, issueDate: '2026-10-11', items: [{ title: 'GST job', qty: 1, rate: 1000000 }], gstEnabled: true, split: { type: 'full' }, status: 'sent' });
    await o2('POST', '/invoices', { client: clientId, issueDate: '2026-10-11', items: [{ title: 'GST draft', qty: 1, rate: 1000000 }], gstEnabled: true, split: { type: 'full' } });
    const after = (await o2('GET', '/reports/gst?from=2026-10-01&to=2026-10-31')).data.totals;
    assert.equal(after.cgst - before.cgst, 90000, 'sent invoice counts, draft does not');
    assert.equal(after.taxable - before.taxable, 1000000);
  });
  await step('dashboard cards', async () => {
    const d = (await o2('GET', '/dashboard?from=2026-10-01&to=2026-10-31')).data;
    assert.equal(typeof d.cards.income, 'number');
    assert.equal(d.cards.net, d.cards.income - d.cards.expenses);
    assert.equal(d.monthly.months.length, 12);
    assert.ok(Array.isArray(d.unpaidInvoices) && Array.isArray(d.recent));
  });
  await step('exports: CSV (BOM, injection-safe), Excel, PDF', async () => {
    const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@smoke.test', password: 'SmokeOwner456' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const get = (u) => fetch(base + u, { headers: { cookie } });
    const csv = await get(`/ledger?format=csv&account=${bankId}`);
    const bytes = Buffer.from(await csv.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 BOM for Excel');
    const text = bytes.toString('utf8');
    assert.match(text, /Date,Type,Doc no\.,Party/);
    const xlsx = await get('/reports/pnl?fy=2026-27&format=xlsx');
    assert.equal(Buffer.from(await xlsx.arrayBuffer()).subarray(0, 2).toString(), 'PK');
    const pdf = await get('/reports/receivables?format=pdf');
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    const { toCsv } = await import('../src/services/exporters.js');
    const out = toCsv({ sheets: [{ name: 'x', columns: [{ key: 'a', label: 'A', type: 'text' }, { key: 'n', label: 'N', type: 'money' }], rows: [{ a: '=HYPERLINK("x")', n: -150 }] }] });
    assert.match(out, /'=HYPERLINK/);
    assert.match(out, /,-1\.5/);
  });
  await step('accountant can read ledger/reports but not add manual entries', async () => {
    const acc = client();
    await acc('POST', '/auth/login', { email: 'acc2@smoke.test', password: 'Accountant123' });
    assert.equal((await acc('GET', '/ledger')).status, 200);
    assert.equal((await acc('GET', '/reports/pnl')).status, 200);
    assert.equal((await acc('POST', '/ledger/entries', { type: 'owner_investment', date: '2026-10-10', amount: 100, account: bankId })).status, 403);
  });
  await step('series without FY never restarts (no duplicate 0001 next April)', async () => {
    const s = (await o2('GET', '/settings')).data.settings.numbering;
    await o2('PUT', '/settings/numbering', { ...s, voucher: { ...s.voucher, includeFy: false, prefix: 'V-' } });
    await runAs(owner, async () => {
      const a = await allocateNumber('voucher', new Date('2027-03-31'));
      const b = await allocateNumber('voucher', new Date('2027-04-01'));
      assert.match(a.number, /^V-\d{4}$/);
      assert.equal(b.seq, a.seq + 1);
    });
    await o2('PUT', '/settings/numbering', s);
  });
  await step('invoice PDF lists payments and balance due', async () => {
    const { renderInvoice } = await import('@webx/shared/templates/index.js');
    const inv = (await o2('GET', `/invoices/${payInv._id}`)).data.invoice;
    const pays = (await o2('GET', `/payments?invoice=${payInv._id}&status=active`)).data.items;
    const html = renderInvoice({ ...inv, payments: pays }, {});
    assert.match(html, /Advance received/);
    assert.ok(html.includes(`Receipt ${pays[0].receiptNumber}`), 'invoice references the receipt');
    assert.match(html, /Balance Due/);
  });
  await step('client details: state code, PIN check, logo on invoice snapshot and PDF', async () => {
    const bad = await o2('POST', '/clients', { name: 'Pin Co', country: 'India', pincode: '1234' });
    assert.equal(bad.status, 400);
    const c = await o2('POST', '/clients', { name: 'Kohli Foods', address: 'SCO 12, Sector 17', city: 'Chandigarh', state: 'Chandigarh', pincode: '160017', phone: '+91 98140 00000', email: 'accounts@kohli.test', pan: 'abcde1234f' });
    assert.equal(c.status, 201, JSON.stringify(c.data));
    assert.equal(c.data.client.stateCode, '04');
    assert.equal(c.data.client.pan, 'ABCDE1234F');
    const fd = new FormData();
    fd.append('logo', new Blob(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'], { type: 'image/svg+xml' }), 'kohli.svg');
    const up = await o2('POST', `/clients/${c.data.client._id}/logo`, null, { form: fd });
    assert.equal(up.status, 200);
    const inv = await o2('POST', '/invoices', { client: c.data.client._id, issueDate: '2026-10-12', items: [{ title: 'Menu design', qty: 1, rate: 500000 }], gstEnabled: true, split: { type: 'full' }, status: 'sent' });
    assert.equal(inv.data.invoice.gst.mode, 'inter', 'Chandigarh (04) vs Punjab (03) → IGST');
    assert.ok(inv.data.invoice.snapshot.client.logo.key.startsWith('client-logos/'));
    assert.equal(inv.data.invoice.snapshot.client.city, 'Chandigarh');
    const { renderInvoice } = await import('@webx/shared/templates/index.js');
    const html = renderInvoice(inv.data.invoice, { assets: { resolveFile: (k) => `X:${k}` } });
    assert.match(html, /class="party-logo" src="X:client-logos\//);
    assert.match(html, /Chandigarh, Chandigarh 160017/);
    assert.match(html, /Place of supply: Chandigarh \(04\)/);
    assert.match(html, /GSTIN|PAN: ABCDE1234F/);
  });
  await step('empty list filters mean "any" (status= is not an error)', async () => {
    for (const path of [`/payments?invoice=${payInv._id}&status=`, '/payouts?status=', '/expenses?status=&category=', '/invoices?status=&client=']) {
      const r = await o2('GET', path);
      assert.equal(r.status, 200, `${path} → ${r.status}`);
    }
    assert.equal((await o2('GET', `/payments?invoice=${payInv._id}&status=`)).data.total, 2, 'active and void');
  });
  // ── Saved services, handover terms, quotes ───────────
  await step('saved services: create, search, deactivate', async () => {
    assert.equal((await o2('POST', '/services', { name: '', rate: 100 })).status, 400);
    const a = await o2('POST', '/services', { name: 'Website Design & Development', description: 'Custom 5-page website', rate: 1500000, unit: 'project', sac: '998314', category: 'Web' });
    assert.equal(a.status, 201, JSON.stringify(a.data));
    await o2('POST', '/services', { name: 'Additional page', rate: 250000, unit: 'page', category: 'Web' });
    assert.equal((await o2('GET', '/services?search=page')).data.total, 2);
    await o2('PUT', `/services/${a.data.service._id}`, { ...a.data.service, rate: 1500000, isActive: false });
    assert.equal((await o2('GET', '/services')).data.total, 1, 'inactive services are hidden from the picker');
  });
  let hoInv;
  await step('handover terms: lists copied from settings, end dates from handover date', async () => {
    const r = await o2('POST', '/invoices', { client: clientId, issueDate: '2026-10-20', items: [{ title: 'Website', qty: 1, rate: 1000000 }], split: { type: 'full' }, status: 'sent', handover: { enabled: true, hostingMonths: 12, maintenanceMonths: 3 } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    hoInv = r.data.invoice;
    assert.equal(hoInv.handover.hostingMonths, 12);
    assert.ok(hoInv.handover.includes.some((x) => /plugin/i.test(x)));
    assert.ok(hoInv.handover.excludes.some((x) => /new pages/i.test(x)));
    const { renderInvoice } = await import('@webx/shared/templates/index.js');
    assert.match(renderInvoice(hoInv, {}), /start on the day the website is handed over/);
  });
  await step('handover date can be set on a paid invoice', async () => {
    const pay = await o2('POST', '/payments', { invoice: hoInv._id, date: '2026-10-21', amount: 1000000, mode: 'upi' });
    assert.equal(pay.data.invoice.status, 'paid');
    const up = await o2('PUT', `/invoices/${hoInv._id}/handover`, { enabled: true, hostingMonths: 12, maintenanceMonths: 3, handoverDate: '2026-11-01' });
    assert.equal(up.status, 200, JSON.stringify(up.data));
    const { renderInvoice } = await import('@webx/shared/templates/index.js');
    const html = renderInvoice(up.data.invoice, {});
    assert.match(html, /until 31 October 2027/, 'hosting 1 year from 1 Nov 2026');
    assert.match(html, /until 31 January 2027/, 'maintenance 3 months from 1 Nov 2026');
    assert.ok(up.data.invoice.handover.includes.length > 0, 'lists kept');
    const log = await o2('GET', `/audit-logs?entity=Invoice&entityId=${hoInv._id}&action=handover`);
    assert.equal(log.data.total, 1);
  });
  let quote;
  await step('quote: draft unnumbered, sent gets QT number, valid-until default', async () => {
    const q = await o2('POST', '/quotes', { client: clientId, issueDate: '2026-10-20', items: [{ title: 'E-commerce website', qty: 1, rate: 4500000 }], split: { type: 'advance', advanceBy: 'percent', advanceValue: 40 }, handover: { enabled: true, hostingMonths: 24, maintenanceMonths: 6 } });
    assert.equal(q.status, 201, JSON.stringify(q.data));
    assert.equal(q.data.quote.number, undefined);
    assert.equal(q.data.quote.validUntil.slice(0, 10), '2026-11-04', '15 days by default');
    const sent = await o2('POST', `/quotes/${q.data.quote._id}/send`);
    assert.match(sent.data.quote.number, /^QT-2026-27\/\d{4}$/);
    quote = sent.data.quote;
  });
  await step('quote: accept → convert to invoice (draft, linked, same items and handover)', async () => {
    assert.equal((await o2('POST', `/quotes/${quote._id}/accept`)).data.quote.status, 'accepted');
    assert.equal((await o2('PUT', `/quotes/${quote._id}`, { client: clientId, issueDate: '2026-10-20', items: [{ title: 'X', qty: 1, rate: 1 }], split: { type: 'full' } })).status, 409, 'accepted quotes are locked');
    const conv = await o2('POST', `/quotes/${quote._id}/convert`);
    assert.equal(conv.status, 201, JSON.stringify(conv.data));
    const inv = conv.data.invoice;
    assert.equal(inv.status, 'draft');
    assert.equal(inv.quoteNumber, quote.number);
    assert.equal(inv.total, 4500000);
    assert.equal(inv.split.advanceAmount, 1800000);
    assert.equal(inv.handover.hostingMonths, 24);
    const q2 = (await o2('GET', `/quotes/${quote._id}`)).data.quote;
    assert.equal(q2.status, 'converted');
    assert.equal((await o2('POST', `/quotes/${quote._id}/convert`)).status, 409, 'no double conversion');
    const { renderInvoice } = await import('@webx/shared/templates/index.js');
    assert.match(renderInvoice(inv, {}), new RegExp(`Quote ref:.*${quote.number.replace('/', '\\/')}`, 's'));
  });
  await step('quote: decline, expired status, duplicate, PDF', async () => {
    const q = await o2('POST', '/quotes', { client: clientId, issueDate: '2026-01-01', validUntil: '2026-01-15', items: [{ title: 'Logo', qty: 1, rate: 500000 }], split: { type: 'full' }, status: 'sent' });
    assert.equal(q.data.quote.displayStatus, 'expired');
    assert.ok((await o2('GET', '/quotes?status=expired')).data.items.some((x) => x._id === q.data.quote._id));
    const dec = await o2('POST', `/quotes/${q.data.quote._id}/decline`, { reason: 'Budget' });
    assert.equal(dec.data.quote.status, 'declined');
    assert.equal((await o2('POST', `/quotes/${q.data.quote._id}/convert`)).status, 409);
    const dup = await o2('POST', `/quotes/${q.data.quote._id}/duplicate`);
    assert.equal(dup.data.quote.status, 'draft');
    const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@smoke.test', password: 'SmokeOwner456' }) });
    const pdf = await fetch(`${base}/quotes/${quote._id}/pdf?download=1`, { headers: { cookie: login.headers.get('set-cookie').split(';')[0] } });
    assert.match(pdf.headers.get('content-disposition'), /Quotation-QT-2026-27-\d{4}-GS-Associates\.pdf/);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  });
  await step('employee profile: code, contacts, emergency, statutory, photo, documents, status', async () => {
    assert.equal((await o2('POST', '/team', { name: 'Bad', type: 'employee', payBasis: 'monthly', phone: '12', payoutDetails: { method: 'upi' } })).status, 400, 'mobile validated');
    assert.equal((await o2('POST', '/team', { name: 'Bad', type: 'employee', payBasis: 'monthly', aadhaarLast4: '123456789012', payoutDetails: { method: 'upi' } })).status, 400, 'only last 4 of Aadhaar');
    const r = await o2('POST', '/team', {
      name: 'Aman Gill', role: 'Developer', department: 'Development', type: 'employee', payBasis: 'monthly', monthlySalary: 3500000,
      phone: '+91 98765 43210', alternatePhone: '9876543211', email: 'aman@thewebxstudio.com', personalEmail: 'aman@gmail.test',
      joiningDate: '2026-04-01', dateOfBirth: '1998-06-12', bloodGroup: 'B+', address: 'House 12, Model Town', city: 'Ludhiana', state: 'Punjab', pincode: '141002',
      emergencyContact: { name: 'Harpreet Gill', relation: 'Father', phone: '+91 98140 00001' }, pan: 'abcde1234f', aadhaarLast4: '4321', uan: '100200300400',
      payoutDetails: { method: 'upi', upiId: 'aman@okicici' },
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    const m = r.data.member;
    assert.match(m.employeeCode, /^EMP-\d{4}$/);
    assert.equal(m.pan, 'ABCDE1234F');
    assert.equal(m.emergencyContact.relation, 'Father');
    const fd = new FormData();
    fd.append('label', 'Offer letter');
    fd.append('file', new Blob([Buffer.from('%PDF-1.4 offer')], { type: 'application/pdf' }), 'offer.pdf');
    const doc = await o2('POST', `/team/${m._id}/documents`, null, { form: fd });
    assert.equal(doc.status, 201, JSON.stringify(doc.data));
    assert.equal(doc.data.member.documents[0].label, 'Offer letter');
    const ph = new FormData();
    ph.append('photo', new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])], { type: 'image/png' }), 'aman.png');
    assert.equal((await o2('POST', `/team/${m._id}/photo`, null, { form: ph })).status, 200);
    assert.equal((await o2('GET', '/team?search=EMP-')).status, 200);
    const left = await o2('PUT', `/team/${m._id}`, { ...m, status: 'left', exitDate: '2026-10-31', exitReason: 'Moved city', employeeCode: undefined, _id: undefined, createdAt: undefined, updatedAt: undefined, __v: undefined, documents: undefined, photo: undefined, createdBy: undefined, updatedBy: undefined, isActive: undefined });
    assert.equal(left.status, 200, JSON.stringify(left.data));
    assert.equal(left.data.member.isActive, false, 'left → cannot be paid');
    const pay = await o2('POST', '/payouts', { member: m._id, date: '2026-11-01', periodLabel: 'October 2026', earnings: [{ label: 'Salary', amount: 100 }], mode: 'upi', paidFrom: cashId });
    assert.equal(pay.status, 400);
    const del = await o2('DELETE', `/team/${m._id}/documents/${doc.data.member.documents[0]._id}`);
    assert.equal(del.data.member.documents.length, 0);
  });
  await step('dashboard lists hosting / maintenance ending soon', async () => {
    const soon = new Date(Date.now() - 80 * 86400000).toISOString().slice(0, 10); // 3-month maintenance → ends in ~10 days
    await o2('PUT', `/invoices/${hoInv._id}/handover`, { enabled: true, hostingMonths: 12, maintenanceMonths: 3, handoverDate: soon });
    const d = (await o2('GET', '/dashboard')).data;
    const r = d.renewals.find((x) => x.invoice === hoInv._id && x.kind === 'Maintenance');
    assert.ok(r, 'maintenance ending soon is listed');
    assert.ok(r.daysLeft > 0 && r.daysLeft <= 15);
    assert.ok(!d.renewals.some((x) => x.invoice === hoInv._id && x.kind === 'Hosting'), 'hosting ends in ~9 months: not listed');
  });
  await step('unknown route returns JSON 404', async () => {
    const r = await o('GET', '/nope');
    assert.equal(r.status, 404);
    assert.ok(r.data.error.message);
  });

  console.log(`\n${passed} checks passed`);
} catch (err) {
  console.error(`\n✗ Failed after ${passed} checks\n`, err);
  process.exitCode = 1;
} finally {
  server.close();
  await closePdfBrowser();
  await disconnectDb();
  await mongo.stop();
}
