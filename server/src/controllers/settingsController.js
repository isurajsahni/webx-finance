import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOC_TYPES } from '@webx/shared/constants.js';
import { fyLabel } from '@webx/shared/fy.js';
import { Settings, recordAudit } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { storage, storeUpload } from '../services/storage/index.js';
import { peekNumber, setNextNumber } from '../services/numbering.js';

const DEFAULT_LOGO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../shared/templates/assets/logo.svg');
// Changes whenever the default logo file changes, so browsers never keep showing an old one.
const DEFAULT_LOGO_VERSION = crypto.createHash('sha1').update(fs.readFileSync(DEFAULT_LOGO)).digest('hex').slice(0, 10);

function present(settings) {
  const obj = settings.toObject();
  const { logo } = obj.company;
  obj.company.logo = logo ? { originalName: logo.originalName, mimeType: logo.mimeType, size: logo.size, updatedAt: settings.updatedAt } : null;
  obj.company.logoUrl = `/api/settings/logo?v=${logo ? new Date(settings.updatedAt).getTime() : `default-${DEFAULT_LOGO_VERSION}`}`;
  const sig = obj.company.signature;
  obj.company.signature = sig ? { originalName: sig.originalName, mimeType: sig.mimeType } : null;
  obj.company.signatureUrl = sig ? `/api/settings/signature?v=${new Date(settings.updatedAt).getTime()}` : null;
  delete obj.__v;
  return obj;
}

export async function getSettings(_req, res) {
  res.json({ settings: present(await Settings.get()) });
}

export async function updateCompany(req, res) {
  const settings = await Settings.get();
  const { logo, signature } = settings.company;
  settings.company = { ...req.body, logo, signature };
  await settings.save();
  res.json({ settings: present(settings) });
}

export async function updatePreferences(req, res) {
  const settings = await Settings.get();
  settings.set(req.body);
  await settings.save();
  res.json({ settings: present(settings) });
}

export async function updateNumbering(req, res) {
  const settings = await Settings.get();
  settings.numbering = req.body;
  await settings.save();
  res.json({ settings: present(settings) });
}

export async function numberingPreview(req, res) {
  const settings = await Settings.get();
  const date = req.query.date ? new Date(`${String(req.query.date).slice(0, 10)}T00:00:00Z`) : new Date();
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('Invalid date');
  const entries = await Promise.all(DOC_TYPES.map(async (t) => [t, await peekNumber(t, date)]));
  res.json({ fy: fyLabel(date, settings.fyStartMonth), next: Object.fromEntries(entries) });
}

export async function setNext(req, res) {
  const { type, fy, next } = req.body;
  const result = await setNextNumber(type, fy, next);
  recordAudit({
    actor: req.user._id,
    actorName: req.user.name,
    action: 'numbering_set',
    entity: 'Counter',
    label: `${type}:${fy}`,
    changes: [{ path: 'next', from: result.previous + 1, to: next }],
    ip: req.ip,
  });
  res.json({ ok: true, ...result });
}

export async function uploadLogo(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose an SVG or PNG file');
  const settings = await Settings.get();
  const previous = settings.company.logo?.key;
  settings.company.logo = await storeUpload(req.file, 'logos');
  await settings.save();
  if (previous) await storage.remove(previous).catch(() => {});
  res.json({ settings: present(settings) });
}

export async function removeLogo(_req, res) {
  const settings = await Settings.get();
  const previous = settings.company.logo?.key;
  settings.company.logo = undefined;
  await settings.save();
  if (previous) await storage.remove(previous).catch(() => {});
  res.json({ settings: present(settings) });
}

export async function getLogo(_req, res) {
  const settings = await Settings.get();
  const logo = settings.company.logo;
  res.set({
    'Cache-Control': 'private, max-age=86400',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });
  if (logo?.key && (await storage.exists(logo.key))) {
    res.type(logo.mimeType);
    return storage.stream(logo.key).pipe(res);
  }
  res.type('image/svg+xml').sendFile(DEFAULT_LOGO);
}

export async function uploadSignature(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose a PNG (transparent background works best)');
  const settings = await Settings.get();
  settings.company.signature = await storeUpload(req.file, 'signatures');
  await settings.save();
  res.json({ settings: present(settings) });
}

export async function removeSignature(_req, res) {
  const settings = await Settings.get();
  settings.company.signature = undefined;
  await settings.save();
  res.json({ settings: present(settings) });
}

export async function getSignature(_req, res) {
  const sig = (await Settings.get()).company.signature;
  if (!sig?.key || !(await storage.exists(sig.key))) throw ApiError.notFound('No signature uploaded');
  res.set({ 'Cache-Control': 'private, max-age=86400', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
  res.type(sig.mimeType);
  storage.stream(sig.key).pipe(res);
}
