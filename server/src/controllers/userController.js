import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';

export async function listUsers(req, res) {
  res.json(await paginate(User, req, { searchFields: ['name', 'email'], sortable: ['name', 'email', 'createdAt'], defaultSort: 'name' }));
}

export async function createUser(req, res) {
  const { password, ...data } = req.body;
  const user = new User(data);
  await user.setPassword(password);
  await user.save();
  res.status(201).json({ user: user.toJSON() });
}

async function assertOwnerRemains(user, next) {
  const losingOwner = user.role === 'owner' && user.isActive && (next.role !== 'owner' || !next.isActive);
  if (!losingOwner) return;
  const otherOwners = await User.countDocuments({ _id: { $ne: user._id }, role: 'owner', isActive: true });
  if (!otherOwners) throw ApiError.badRequest('There must be at least one active owner');
}

export async function updateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user._id.equals(req.user._id) && (!req.body.isActive || req.body.role !== user.role)) {
    throw ApiError.badRequest('You cannot change your own role or deactivate yourself');
  }
  await assertOwnerRemains(user, req.body);
  const deactivating = user.isActive && !req.body.isActive;
  user.set(req.body);
  if (deactivating) user.tokenVersion += 1; // sign them out everywhere
  await user.save();
  res.json({ user: user.toJSON() });
}

export async function resetPassword(req, res) {
  const user = await User.findById(req.params.id).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');
  await user.setPassword(req.body.password);
  user.$locals.auditAction = 'password_reset';
  await user.save();
  res.json({ ok: true });
}
