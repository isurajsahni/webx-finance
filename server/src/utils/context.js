// Per-request context (current user, IP) available anywhere without threading
// it through every function. Used by the audit plugin.
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

export function contextMiddleware(req, _res, next) {
  storage.run({ ip: req.ip, user: null }, next);
}

export function getContext() {
  return storage.getStore() || {};
}

export function setContextUser(user) {
  const store = storage.getStore();
  if (store) store.user = user;
}

/** Run code (e.g. seed script) as a given user. */
export function runAs(user, fn) {
  return storage.run({ ip: 'system', user }, fn);
}
