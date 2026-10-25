import mongoose from 'mongoose';
import { z } from 'zod';
import { fileSafe } from '@webx/shared/numbering.js';
import { renderPayslip, computePayout } from '@webx/shared/templates/index.js';
import { BankAccount, Counter, Payout, Settings, TeamMember } from '../models/index.js';
import { storeUpload } from '../services/storage/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { allocateNumber } from '../services/numbering.js';
import { sendDocumentPdf } from '../services/pdfResponse.js';

const oid = (v) => new mongoose.Types.ObjectId(String(v));

async function payoutStats(memberIds) {
  const rows = await Payout.aggregate([
    { $match: { member: { $in: memberIds.map(oid) }, status: 'active' } },
    { $group: { _id: '$member', count: { $sum: 1 }, totalNet: { $sum: '$net' }, lastPaidAt: { $max: '$date' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}
const emptyStats = { count: 0, totalNet: 0, lastPaidAt: null };

// ── Team members ──
export async function listMembers(req, res) {
  const { active } = z.object({ active: z.enum(['1', '0', 'all']).default('1') }).parse(req.query);
  const filter = active === 'all' ? {} : { isActive: active === '1' };
  const page = await paginate(TeamMember, req, { filter, searchFields: ['name', 'role', 'department', 'employeeCode', 'email', 'phone'], sortable: ['name', 'createdAt'], defaultSort: 'name' });
  const stats = await payoutStats(page.items.map((m) => m._id));
  page.items = page.items.map((m) => ({ ...m, stats: stats.get(String(m._id)) || emptyStats }));
  res.json(page);
}

export async function getMember(req, res) {
  const m = await TeamMember.findById(req.params.id).lean();
  if (!m) throw ApiError.notFound('Team member not found');
  const stats = await payoutStats([m._id]);
  res.json({ member: { ...m, stats: stats.get(String(m._id)) || emptyStats } });
}

/** Someone who has left can't be paid; "active" / "on notice" can. */
const withStatus = (b) => ({ ...b, isActive: b.status !== 'left', exitDate: b.status === 'active' ? null : b.exitDate });

async function nextEmployeeCode() {
  const c = await Counter.findOneAndUpdate({ _id: 'employee:all' }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  return `EMP-${String(c.seq).padStart(4, '0')}`;
}

export async function createMember(req, res) {
  const member = new TeamMember(withStatus(req.body));
  await member.validate();
  member.employeeCode = await nextEmployeeCode();
  res.status(201).json({ member: await member.save() });
}

export async function uploadPhoto(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose a photo');
  const m = await TeamMember.findById(req.params.id);
  if (!m) throw ApiError.notFound('Team member not found');
  m.photo = await storeUpload(req.file, 'team-photos');
  res.json({ member: await m.save() });
}

export async function addDocument(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose a file');
  const label = String(req.body?.label || '').trim().slice(0, 80) || req.file.originalname;
  const m = await TeamMember.findById(req.params.id);
  if (!m) throw ApiError.notFound('Team member not found');
  if (m.documents.length >= 20) throw ApiError.badRequest('Up to 20 documents per person');
  m.documents.push({ label, file: await storeUpload(req.file, 'team-docs') });
  res.status(201).json({ member: await m.save() });
}

export async function removeDocument(req, res) {
  const m = await TeamMember.findById(req.params.id);
  if (!m) throw ApiError.notFound('Team member not found');
  const before = m.documents.length;
  m.documents = m.documents.filter((d) => String(d._id) !== req.params.docId);
  if (m.documents.length === before) throw ApiError.notFound('Document not found');
  res.json({ member: await m.save() }); // file kept on disk; the audit log records the removal
}

export async function updateMember(req, res) {
  const m = await TeamMember.findById(req.params.id);
  if (!m) throw ApiError.notFound('Team member not found');
  m.set(withStatus(req.body));
  res.json({ member: await m.save() });
}

export async function setMemberActive(req, res) {
  const m = await TeamMember.findById(req.params.id);
  if (!m) throw ApiError.notFound('Team member not found');
  m.isActive = req.path.endsWith('/activate');
  m.status = m.isActive ? 'active' : 'left';
  if (!m.isActive && !m.exitDate) m.exitDate = new Date();
  res.json({ member: await m.save() });
}

// ── Payouts ──
export async function listPayouts(req, res) {
  const q = req.validatedQuery;
  const filter = {};
  if (q.member) filter.member = oid(q.member);
  if (q.status) filter.status = q.status;
  if (q.from || q.to) filter.date = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  const page = await paginate(Payout, req, {
    filter,
    searchFields: ['voucherNumber', 'snapshot.member.name', 'periodLabel', 'project', 'reference'],
    sortable: ['date', 'net', 'createdAt'],
    defaultSort: '-date -createdAt',
  });
  const [summary] = await Payout.aggregate([
    { $match: { ...filter, status: filter.status || 'active' } },
    { $group: { _id: null, count: { $sum: 1 }, net: { $sum: '$net' }, gross: { $sum: '$gross' }, deductions: { $sum: '$totalDeductions' } } },
  ]);
  res.json({ ...page, summary: summary || { count: 0, net: 0, gross: 0, deductions: 0 } });
}

export async function getPayout(req, res) {
  const p = await Payout.findById(req.params.id).populate('paidFrom', 'label kind').lean();
  if (!p) throw ApiError.notFound('Payout not found');
  res.json({ payout: p });
}

export async function createPayout(req, res) {
  const b = req.body;
  const member = await TeamMember.findById(b.member);
  if (!member) throw ApiError.badRequest('Team member not found', [{ path: 'member', message: 'Team member not found' }]);
  if (!member.isActive) throw ApiError.badRequest('This team member is inactive', [{ path: 'member', message: 'Inactive member' }]);
  const from = await BankAccount.findById(b.paidFrom);
  if (!from) throw ApiError.badRequest('Account not found', [{ path: 'paidFrom', message: 'Account not found' }]);
  const company = (await Settings.get()).company;
  const totals = computePayout(b);

  const doc = new Payout({
    ...b,
    voucherNumber: 'pending',
    ...totals,
    snapshot: {
      member: { name: member.name, role: member.role, type: member.type, email: member.email, phone: member.phone, payoutDetails: member.payoutDetails?.toObject?.() ?? member.payoutDetails },
      company: { name: company.name, tagline: company.tagline, address: company.address, phones: company.phones, email: company.email, website: company.website },
      paidFrom: { kind: from.kind, label: from.label, bankName: from.bankName, accountNumber: from.accountNumber },
    },
  });
  await doc.validate();
  const { number, seq, fy } = await allocateNumber('payslip', b.date);
  Object.assign(doc, { voucherNumber: number, seq, fy });
  res.status(201).json({ payout: await doc.save() });
}

export async function voidPayout(req, res) {
  const p = await Payout.findById(req.params.id);
  if (!p) throw ApiError.notFound('Payout not found');
  if (p.status === 'void') throw ApiError.conflict('Already void');
  Object.assign(p, { status: 'void', voidReason: req.body.reason, voidedAt: new Date(), voidedBy: req.user._id });
  p.$locals.auditAction = 'void';
  res.json({ payout: await p.save() });
}

export async function payslipPdf(req, res) {
  const p = await Payout.findById(req.params.id).lean();
  if (!p) throw ApiError.notFound('Payout not found');
  const kind = p.snapshot?.member?.type === 'freelancer' ? 'Voucher' : 'Payslip';
  await sendDocumentPdf(req, res, { doc: p, render: renderPayslip, filename: `${kind}-${fileSafe(p.voucherNumber)}-${fileSafe(p.snapshot?.member?.name || 'Member')}.pdf` });
}
