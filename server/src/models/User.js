import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '@webx/shared/constants.js';
import { auditPlugin } from '../plugins/audit.js';

const { Schema } = mongoose;
const BCRYPT_ROUNDS = 12;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'accountant' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
    // Bumped on password change / deactivation to invalidate existing JWTs.
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.tokenVersion;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, BCRYPT_ROUNDS);
  this.tokenVersion = (this.tokenVersion || 0) + 1;
};

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.plugin(auditPlugin, { entity: 'User', skip: ['lastLoginAt'] });

export const User = mongoose.model('User', userSchema);
