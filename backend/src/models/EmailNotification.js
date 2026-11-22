import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const EmailNotificationSchema = new Schema({
  eventKey: { type: String, required: true, unique: true, maxlength: 200 },
  status: { type: String, enum: ['pending', 'sent', 'failed'], required: true, default: 'pending' }
}, { timestamps: true, versionKey: false });

export default model('EmailNotification', EmailNotificationSchema);
