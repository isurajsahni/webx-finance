// Document numbering. Sequences reset each financial year and are never
// reused: the counter only ever moves forward, even if a document is voided.
import { counterKey, formatDocNumber } from '@webx/shared/numbering.js';
import { fyLabel } from '@webx/shared/fy.js';
import { DOC_TYPES } from '@webx/shared/constants.js';
import { Counter, Settings } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

function assertType(type) {
  if (!DOC_TYPES.includes(type)) throw ApiError.badRequest(`Unknown document type: ${type}`);
}

/** Atomically allocate the next number for `type` in the FY containing `date`. */
export async function allocateNumber(type, date = new Date(), { session } = {}) {
  assertType(type);
  const settings = await Settings.get();
  const fy = fyLabel(date, settings.fyStartMonth);
  const counter = await Counter.findOneAndUpdate(
    { _id: counterKey(type, fy, settings.numbering[type].includeFy) },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', session },
  );
  return { number: formatDocNumber(counter.seq, settings.numbering[type], fy), seq: counter.seq, fy };
}

/** What the next number would be, without allocating it. */
export async function peekNumber(type, date = new Date()) {
  assertType(type);
  const settings = await Settings.get();
  const fy = fyLabel(date, settings.fyStartMonth);
  const counter = await Counter.findById(counterKey(type, fy, settings.numbering[type].includeFy)).lean();
  const seq = (counter?.seq ?? 0) + 1;
  return { number: formatDocNumber(seq, settings.numbering[type], fy), seq, fy };
}

/**
 * Move a series forward so the next allocated number is `next` (e.g. continue
 * from 0903 when migrating from another tool). Moving backwards is refused
 * because it could reissue an existing number.
 */
export async function setNextNumber(type, fy, next) {
  assertType(type);
  const settings = await Settings.get();
  const key = counterKey(type, fy, settings.numbering[type].includeFy);
  const current = (await Counter.findById(key).lean())?.seq ?? 0;
  if (next <= current) {
    throw ApiError.conflict(`Numbers up to ${current} are already used in ${fy}. Next number must be greater than ${current}.`);
  }
  const updated = await Counter.findOneAndUpdate(
    { _id: key, seq: current },
    { $set: { seq: next - 1 } },
    { upsert: current === 0, returnDocument: 'after' },
  ).catch((err) => {
    if (err?.code === 11000) return null;
    throw err;
  });
  if (!updated) throw ApiError.conflict('The number series changed while saving. Please retry.');
  return { previous: current, next };
}

/**
 * Register a manually typed number (manual override). Bumps the counter if
 * the manual sequence is ahead so auto-numbering never collides with it.
 */
export async function registerManualSeq(type, fy, seq, { session } = {}) {
  assertType(type);
  const settings = await Settings.get();
  await Counter.updateOne({ _id: counterKey(type, fy, settings.numbering[type].includeFy) }, { $max: { seq } }, { upsert: true, session });
}
