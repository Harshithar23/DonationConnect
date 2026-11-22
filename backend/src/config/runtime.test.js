import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRuntimeConfig } from './runtime.js';

const productionConfig = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a-unique-production-secret-that-is-long-enough',
  MONGODB_URI: 'mongodb+srv://user:password@cluster.example.net/donationconnect',
  CLIENT_ORIGIN: 'https://donationconnect.example',
  FRONTEND_URL: 'https://donationconnect.example',
  EMAIL_USER: 'donationconnect@gmail.com',
  EMAIL_APP_PASSWORD: 'test-app-password',
  EMAIL_FROM: 'DonationConnect <donationconnect@gmail.com>'
};

test('allows valid production configuration', () => {
  assert.doesNotThrow(() => validateRuntimeConfig(productionConfig));
});

test('keeps development configuration checks relaxed', () => {
  assert.doesNotThrow(() => validateRuntimeConfig({ NODE_ENV: 'development' }));
});

test('rejects placeholder and local database configuration in production', () => {
  assert.throws(() => validateRuntimeConfig({
    ...productionConfig,
    MONGODB_URI: 'mongodb://127.0.0.1:27017/donationconnect'
  }), /remote MongoDB/);
});

test('rejects invalid DNS resolver addresses', () => {
  assert.throws(() => validateRuntimeConfig({
    ...productionConfig,
    DNS_SERVERS: '1.1.1.1,not-an-ip'
  }), /DNS_SERVERS/);
});

test('requires no payment or external automation configuration', () => {
  assert.doesNotThrow(() => validateRuntimeConfig({
    ...productionConfig
  }));
});

test('requires public HTTPS origins and Gmail SMTP configuration', () => {
  assert.throws(() => validateRuntimeConfig({
    ...productionConfig,
    CLIENT_ORIGIN: 'http://localhost:5173'
  }), /public HTTPS/);
  assert.throws(() => validateRuntimeConfig({
    ...productionConfig,
    EMAIL_APP_PASSWORD: ''
  }), /EMAIL_USER, EMAIL_APP_PASSWORD, and EMAIL_FROM/);
});

test('rejects invalid Gmail sender addresses in production', () => {
  assert.throws(() => validateRuntimeConfig({
    ...productionConfig,
    EMAIL_FROM: 'DonationConnect <not-an-email>'
  }), /valid email address/);
});
