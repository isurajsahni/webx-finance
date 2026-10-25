import mongoose from 'mongoose';

const { Schema } = mongoose;

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    action: { type: String, required: true }, // create | update | void | status | login | password ...
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId },
    label: String,
    changes: [{ _id: false, path: String, from: Schema.Types.Mixed, to: Schema.Types.Mixed }],
    ip: String,
  },
  { timestamps: { createdAt: 'at', updatedAt: false } },
);

auditLogSchema.index({ entity: 1, entityId: 1, at: -1 });
auditLogSchema.index({ at: -1 });

// Append-only: block edits and deletes at the model level.
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'replaceOne']) {
  auditLogSchema.pre(op, function () {
    throw new Error('Audit log is append-only');
  });
}

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

/** Record an event that is not a document save (login, password change...). */
export function recordAudit(entry) {
  return AuditLog.create(entry).catch((err) => console.error('Audit log write failed', err));
}
