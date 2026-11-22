import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import ngoRoutes from './routes/ngos.js';
import requestRoutes from './routes/requests.js';
import donationRoutes from './routes/donations.js';
import adminRoutes from './routes/admin.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { createApiRateLimiter } from './middleware/apiRateLimit.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(origin => origin.trim()),
    credentials: false
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false }));
  app.get('/api/health', (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
      status: connected ? 'ok' : 'unavailable',
      database: connected ? 'connected' : 'disconnected',
      service: 'DonationConnect API',
      time: new Date().toISOString()
    });
  });
  app.use('/api', createApiRateLimiter());
  app.use('/api/auth', authRoutes);
  app.use('/api/ngos', ngoRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/donations', donationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
