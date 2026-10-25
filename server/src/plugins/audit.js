// Mongoose plugin: writes an AuditLog row whenever a document is created or
// changed through doc.save(). Controllers should always mutate via save() (not
// updateOne/findOneAndUpdate) so every change is captured.
//
// Set doc.$locals.auditAction = 'void' | 'status' | ... before save() to label
// the change; defaults to 'create' / 'update'.
import mongoose from 'mongoose';
import { getContext } from '../utils/context.js';

const ALWAYS_SKIP = new Set(['_id', '__v', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'passwordHash', 'tokenVersion']);

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof mongoose.Types.ObjectId) && !Buffer.isBuffer(v)) {
      flatten(v, path, out);
    } else {
      out[path] = v;
    }
  }
  return out;
}

const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const norm = (v) => (isEmpty(v) ? null : JSON.parse(JSON.stringify(v)));

export function diff(before, after, skip = new Set()) {
  const a = flatten(before);
  const b = flatten(after);
  const changes = [];
  for (const path of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const root = path.split('.')[0];
    if (ALWAYS_SKIP.has(root) || skip.has(root) || skip.has(path)) continue;
    const from = norm(a[path]);
    const to = norm(b[path]);
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ path, from, to });
  }
  return changes;
}

export function auditPlugin(schema, { entity, skip = [] } = {}) {
  const skipSet = new Set(skip);

  schema.post('init', function () {
    this.$locals.auditOriginal = this.toObject({ depopulate: true, virtuals: false });
  });

  schema.pre('save', function () {
    const { user } = getContext();
    if (user) {
      if (this.isNew && schema.path('createdBy')) this.createdBy ??= user._id;
      if (schema.path('updatedBy')) this.updatedBy = user._id;
    }
    this.$locals.auditWasNew = this.isNew;
  });

  schema.post('save', async function (doc) {
    const current = doc.toObject({ depopulate: true, virtuals: false });
    const changes = doc.$locals.auditWasNew ? [] : diff(doc.$locals.auditOriginal, current, skipSet);
    const action = doc.$locals.auditAction || (doc.$locals.auditWasNew ? 'create' : 'update');
    doc.$locals.auditOriginal = current;
    doc.$locals.auditAction = undefined;

    if (!doc.$locals.auditWasNew && !changes.length) return;

    const { user, ip } = getContext();
    try {
      await mongoose.model('AuditLog').create({
        actor: user?._id,
        actorName: user?.name,
        action,
        entity: entity || doc.constructor.modelName,
        entityId: doc._id,
        label: doc.$locals.auditLabel,
        changes,
        ip,
      });
    } catch (err) {
      console.error('Audit log write failed', err);
    }
  });
}
