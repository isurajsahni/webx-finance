import bcrypt from 'bcryptjs';
import { User, recordAudit } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { setContextUser } from '../utils/context.js';
import { setAuthCookie, clearAuthCookie } from '../services/tokens.js';

// Compared against when the email does not exist, so response time does not
// reveal which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);

  if (!user || !ok || !user.isActive) {
    if (user) recordAudit({ actor: user._id, actorName: user.name, action: 'login_failed', entity: 'User', entityId: user._id, ip: req.ip });
    throw ApiError.unauthorized('Invalid email or password');
  }

  user.lastLoginAt = new Date();
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: user.lastLoginAt } });
  setContextUser(user);
  recordAudit({ actor: user._id, actorName: user.name, action: 'login', entity: 'User', entityId: user._id, ip: req.ip });

  setAuthCookie(res, user);
  res.json({ user: user.toJSON() });
}

export function logout(_req, res) {
  clearAuthCookie(res);
  res.json({ ok: true });
}

export function me(req, res) {
  res.json({ user: req.user.toJSON() });
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.checkPassword(req.body.currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect', [{ path: 'currentPassword', message: 'Current password is incorrect' }]);
  }
  await user.setPassword(req.body.newPassword);
  user.$locals.auditAction = 'password_change';
  await user.save();
  recordAudit({ actor: user._id, actorName: user.name, action: 'password_change', entity: 'User', entityId: user._id, ip: req.ip });
  setAuthCookie(res, user); // old sessions are invalidated, keep this one
  res.json({ ok: true });
}
