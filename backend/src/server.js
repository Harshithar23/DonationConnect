import dotenv from 'dotenv';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { validateRuntimeConfig } from './config/runtime.js';
import { connectDB } from './config/db.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
validateRuntimeConfig(process.env);
const { createApp } = await import('./app.js');
const app = createApp();
const dnsServers = (process.env.DNS_SERVERS || '').split(',').map(server => server.trim()).filter(Boolean);
if (dnsServers.length) dns.setServers(dnsServers);

const port = Number(process.env.PORT || 5000);
connectDB().then(() => {
  const server = app.listen(port, () => console.log(`DonationConnect API listening on ${port}`));
  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; shutting down gracefully.`);
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async error => {
      try {
        await mongoose.disconnect();
        if (error) console.error(`HTTP server shutdown failed: ${error.message}`);
        process.exit(error ? 1 : 0);
      } catch (disconnectError) {
        console.error(`MongoDB shutdown failed: ${disconnectError.message}`);
        process.exit(1);
      }
    });
  }
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}).catch(error => {
  console.error(`Database connection failed: ${error.message}`);
  process.exit(1);
});
