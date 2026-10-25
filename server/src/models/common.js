import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Money in minor units (paise). Always an integer. */
export const Money = (extra = {}) => ({
  type: Number,
  default: 0,
  validate: { validator: Number.isInteger, message: '{PATH} must be a whole number of paise' },
  ...extra,
});

export const FileRefSchema = new Schema(
  {
    key: { type: String, required: true }, // storage key, e.g. "logos/abc.png"
    originalName: String,
    mimeType: String,
    size: Number,
    storage: { type: String, default: 'local' },
  },
  { _id: false },
);

/** Fields for soft-cancelling financial records. Documents are never hard-deleted. */
export const voidFields = {
  voidReason: { type: String, trim: true },
  voidedAt: Date,
  voidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
};

/** createdBy / updatedBy filled from the request context. */
export function actorPlugin(schema) {
  schema.add({
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  });
}
