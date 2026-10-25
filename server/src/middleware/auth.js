import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { setContextUser } from '../utils/context.js';
import { AUTH_COOKIE, verifyToken } from '../services/tokens.js';

export async function requireAuth(req, _res, next) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return next(ApiError.unauthorized());

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(ApiError.unauthorized('Your session has expired. Please sign in again.'));
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
    return next(ApiError.unauthorized('Your session has expired. Please sign in again.'));
  }

  req.user = user;
  setContextUser(user);
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

/** Owner-only: settings, users, deletes/voids. */
export const ownerOnly = requireRole('owner');
