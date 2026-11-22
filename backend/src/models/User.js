import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const UserSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['individual', 'company', 'organization', 'ngo', 'admin'], required: true },
  phone: { type: String, trim: true, maxlength: 25 },
  profile: { address: String, city: String, state: String, postalCode: String, website: String, bio: { type: String, maxlength: 1000 }, avatarUrl: String },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  tokenVersion: { type: Number, min: 0, default: 0 },
  emailVerified: { type: Boolean, default: false },
  lastLoginFingerprint: { type: String, select: false },
  resetTokenHash: { type: String, select: false },
  resetTokenExpiresAt: { type: Date, select: false },
  resetOtpAttempts: { type: Number, min: 0, max: 5, default: 0, select: false },
  resetOtpSentAt: { type: Date, select: false },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });
UserSchema.set('toJSON', { transform: (_, ret) => { delete ret.passwordHash; delete ret.resetTokenHash; delete ret.resetTokenExpiresAt; delete ret.resetOtpAttempts; delete ret.resetOtpSentAt; delete ret.lastLoginFingerprint; delete ret.tokenVersion; return ret; } });
export default model('User', UserSchema);
