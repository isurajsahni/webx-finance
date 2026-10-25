import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const AUTH_COOKIE = 'webx_token';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), tv: user.tokenVersion, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: 'HS256',
  });
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
}

function cookieMaxAge() {
  const decoded = jwt.decode(jwt.sign({}, 'x', { expiresIn: env.JWT_EXPIRES_IN }));
  return (decoded.exp - decoded.iat) * 1000;
}

const baseCookie = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  path: '/',
});

export function setAuthCookie(res, user) {
  res.cookie(AUTH_COOKIE, signToken(user), { ...baseCookie(), maxAge: cookieMaxAge() });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, baseCookie());
}
