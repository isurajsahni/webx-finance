import mongoose from 'mongoose';

// One row per document type per financial year, e.g. _id "invoice:2026-27".
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false, timestamps: true },
);

export const Counter = mongoose.model('Counter', counterSchema);
