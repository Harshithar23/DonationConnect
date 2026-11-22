
import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error(
      'MONGODB_URI is missing. Add it to backend/.env.'
    );
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000
    });
  } catch (error) {
    console.error('MongoDB connection diagnostic:', {
      name: error.name,
      code: error.code,
      message: error.message,
      causeName: error.cause?.name,
      causeCode: error.cause?.code,
      causeMessage: error.cause?.message
    });

    throw error;
  }

  console.log(
    `MongoDB connected: ${mongoose.connection.name}`
  );
}
