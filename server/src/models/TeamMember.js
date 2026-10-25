import mongoose from 'mongoose';
import { MEMBER_TYPES, PAY_BASIS } from '@webx/shared/constants.js';
import { Money, FileRefSchema, actorPlugin } from './common.js';
import { auditPlugin } from '../plugins/audit.js';

const teamMemberSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, trim: true, unique: true, sparse: true }, // EMP-0001, assigned on create
    name: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, trim: true, maxlength: 80 }, // designation, e.g. "UI Designer"
    department: { type: String, trim: true, maxlength: 60 },
    photo: { type: FileRefSchema, default: undefined },
    type: { type: String, enum: MEMBER_TYPES, default: 'freelancer' },
    payBasis: { type: String, enum: PAY_BASIS, default: 'per_project' },
    monthlySalary: Money(),
    projectRate: Money(),
    phone: { type: String, trim: true, maxlength: 30 }, // mobile
    alternatePhone: { type: String, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 }, // work email
    personalEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
    joiningDate: Date,
    status: { type: String, enum: ['active', 'on_notice', 'left'], default: 'active' },
    exitDate: Date,
    exitReason: { type: String, trim: true, maxlength: 300 },

    dateOfBirth: Date,
    bloodGroup: { type: String, trim: true, maxlength: 4 },
    address: { type: String, trim: true, maxlength: 400 },
    city: { type: String, trim: true, maxlength: 80 },
    state: { type: String, trim: true, maxlength: 60 },
    pincode: { type: String, trim: true, maxlength: 12 },
    emergencyContact: {
      name: { type: String, trim: true, maxlength: 120 },
      relation: { type: String, trim: true, maxlength: 40 },
      phone: { type: String, trim: true, maxlength: 30 },
    },
    // Statutory IDs. Only the last 4 digits of Aadhaar are stored, never the full number.
    pan: { type: String, trim: true, uppercase: true },
    aadhaarLast4: { type: String, trim: true, maxlength: 4 },
    uan: { type: String, trim: true, maxlength: 12 },
    documents: [
      {
        label: { type: String, trim: true, maxlength: 80 },
        file: { type: FileRefSchema, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    payoutDetails: {
      method: { type: String, enum: ['upi', 'bank'], default: 'upi' },
      upiId: { type: String, trim: true },
      accountName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifsc: { type: String, trim: true, uppercase: true },
      bankName: { type: String, trim: true },
    },
    notes: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

teamMemberSchema.index({ isActive: 1, name: 1 });
teamMemberSchema.plugin(actorPlugin);
teamMemberSchema.plugin(auditPlugin, { entity: 'TeamMember' });

export const TeamMember = mongoose.model('TeamMember', teamMemberSchema);
