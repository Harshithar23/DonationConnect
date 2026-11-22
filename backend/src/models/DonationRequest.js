import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const DonationRequestSchema = new Schema({
  ngo: { type: Schema.Types.ObjectId, ref: 'NGO', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  category: { type: String, enum: ['food', 'clothing', 'education', 'medical', 'shelter', 'other'], required: true },
  donationType: { type: String, enum: ['money', 'goods', 'both'], required: true },
  targetAmount: { type: Number, min: 0, default: 0 }, amountRaised: { type: Number, min: 0, default: 0 },
  goodsNeeded: [{ item: { type: String, required: true }, quantity: { type: Number, min: 1, required: true }, unit: { type: String, default: 'items' }, quantityReceived: { type: Number, min: 0, default: 0 } }],
  location: { city: String, state: String, address: String },
  deadline: Date, imageUrl: String,
  status: { type: String, enum: ['pending', 'approved', 'reserved', 'rejected', 'fulfilled', 'closed'], default: 'pending', index: true },
  adminNotes: String, reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' }, reviewedAt: Date,
  deletedAt: Date, deletedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, versionKey: false });
export default model('DonationRequest', DonationRequestSchema);
