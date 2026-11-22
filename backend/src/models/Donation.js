import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const DonationSchema = new Schema({
  donor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ngo: { type: Schema.Types.ObjectId, ref: 'NGO', required: true, index: true },
  request: { type: Schema.Types.ObjectId, ref: 'DonationRequest' },
  type: { type: String, enum: ['money', 'goods'], required: true },
  amount: { type: Number, min: 1 }, currency: { type: String, default: 'INR' },
  items: [{ name: { type: String, required: true }, quantity: { type: Number, min: 1, required: true }, unit: { type: String, default: 'items' }, estimatedValue: { type: Number, min: 0, default: 0 } }],
  status: { type: String, enum: ['pledged', 'awaiting_payment_verification', 'confirmed', 'pickup_scheduled', 'collected', 'received', 'completed', 'cancelled', 'disputed'], default: 'pledged', index: true },
  payment: { type: Schema.Types.Mixed, default: () => ({ method: 'pledge_only', verificationStatus: 'not_required' }) },
  pickup: { donorName: String, phone: String, address: String, city: String, state: String, postalCode: String, preferredDate: Date, notes: String },
  tracking: [{ status: String, note: String, actor: { type: Schema.Types.ObjectId, ref: 'User' }, timestamp: { type: Date, default: Date.now } }],
  receiptUrl: String
}, { timestamps: true, versionKey: false });
DonationSchema.pre('validate', function(next) {
  if (this.type === 'money' && (!this.amount || this.amount < 1)) this.invalidate('amount', 'Money donations require an amount greater than zero.');
  if (this.type === 'goods' && (!this.items || !this.items.length)) this.invalidate('items', 'Goods donations require at least one item.');
  next();
});
export default model('Donation', DonationSchema);
