import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const NGOSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  legalName: { type: String, required: true, trim: true, maxlength: 200 },
  registrationType: { type: String, enum: ['trust', 'society', 'section8', 'other'], required: true },
  registrationNumber: { type: String, required: true, trim: true },
  registrationAuthority: String, registeredAddress: { type: String, required: true },
  website: String, causeAreas: [{ type: String, maxlength: 80 }],
  documents: [{ kind: { type: String, enum: ['registration_certificate', 'pan', 'tax_exemption', 'address_proof', 'other'] }, fileUrl: { type: String, required: true }, uploadedAt: { type: Date, default: Date.now } }],
  verificationStatus: { type: String, enum: ['pending', 'under_review', 'approved', 'rejected', 'suspended'], default: 'pending', index: true },
  verificationNotes: String, reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' }, reviewedAt: Date,
  riskScore: { type: Number, min: 0, max: 100, default: 0 }, riskFlags: [String]
}, { timestamps: true, versionKey: false });
export default model('NGO', NGOSchema);
