import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import { connectDB } from './config/db.js';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 14) throw new Error('Set MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD (minimum 14 characters) in backend/.env');
try {
  await connectDB();
  const email = ADMIN_EMAIL.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) console.log('Admin email already exists; no changes made.');
  else {
    await User.create({ name: 'DonationConnect Admin', email, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12), role: 'admin', emailVerified: true });
    console.log(`Admin created: ${email}`);
  }
} finally {
  await mongoose.disconnect();
}
