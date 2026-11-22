import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import test from 'node:test';
import Donation from '../models/Donation.js';
import NGO from '../models/NGO.js';
import User from '../models/User.js';
import { errorHandler, notFound } from '../middleware/errors.js';
import donationRoutes from './donations.js';

const secret = 'route-test-secret-with-at-least-thirty-two-characters';

async function startDonationApi(t, role = 'individual') {
  const userId = new mongoose.Types.ObjectId();
  const ngoId = new mongoose.Types.ObjectId();
  const user = { _id: userId, name: 'Test Donor', email: 'donor@example.test', role, status: 'active', tokenVersion: 0 };
  const priorSecret = process.env.JWT_SECRET;
  const priorEmailUser = process.env.EMAIL_USER;
  const priorEmailAppPassword = process.env.EMAIL_APP_PASSWORD;
  const priorEmailFrom = process.env.EMAIL_FROM;
  process.env.JWT_SECRET = secret;
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_APP_PASSWORD;
  delete process.env.EMAIL_FROM;
  t.after(() => {
    if (priorSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = priorSecret;
    if (priorEmailUser === undefined) delete process.env.EMAIL_USER;
    else process.env.EMAIL_USER = priorEmailUser;
    if (priorEmailAppPassword === undefined) delete process.env.EMAIL_APP_PASSWORD;
    else process.env.EMAIL_APP_PASSWORD = priorEmailAppPassword;
    if (priorEmailFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = priorEmailFrom;
  });
  t.mock.method(console, 'error', () => {});
  t.mock.method(User, 'findById', () => ({ select: async () => user }));

  const app = express();
  app.use(express.json());
  app.use('/api/donations', donationRoutes);
  app.use(notFound);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  return {
    user,
    ngoId,
    token: jwt.sign({ sub: userId.toString(), role, ver: 0 }, secret, { expiresIn: '1h' }),
    post: (path, body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${jwt.sign({ sub: userId.toString(), role, ver: 0 }, secret, { expiresIn: '1h' })}`, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }),
    patch: (path, body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${jwt.sign({ sub: userId.toString(), role, ver: 0 }, secret, { expiresIn: '1h' })}`, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  };
}

test('money donation endpoint records a pledge without payment instructions or paid status', async t => {
  const api = await startDonationApi(t);
  t.mock.method(NGO, 'findOne', async () => ({ _id: api.ngoId, legalName: 'Example Trust' }));
  t.mock.method(Donation.prototype, 'save', async function savePledge() { return this; });

  const response = await api.post('/api/donations', {
    ngoId: api.ngoId.toString(),
    type: 'money',
    amount: 1000
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.donation.status, 'pledged');
  assert.equal(body.donation.payment.method, 'pledge_only');
  assert.equal(body.donation.payment.verificationStatus, 'not_required');
  assert.match(body.donation.tracking[0].note, /no payment was processed/);
  assert.equal(Object.hasOwn(body, 'paymentInstructions'), false);
  assert.deepEqual(body.donation.payment, { method: 'pledge_only', verificationStatus: 'not_required' });
});

test('donation endpoint enforces donor role and validates money amount', async t => {
  const companyApi = await startDonationApi(t, 'company');
  const moneyResponse = await companyApi.post('/api/donations', {
    ngoId: companyApi.ngoId.toString(),
    type: 'money',
    amount: 1000
  });
  assert.equal(moneyResponse.status, 403);

  companyApi.user.role = 'individual';
  const donorApi = companyApi;
  const invalidAmount = await donorApi.post('/api/donations', {
    ngoId: donorApi.ngoId.toString(),
    type: 'money',
    amount: 1500
  });
  assert.equal(invalidAmount.status, 400);
  assert.match((await invalidAmount.json()).message, /Invalid donation data/);
});

test('goods donations require and preserve item and pickup details', async t => {
  const api = await startDonationApi(t, 'company');
  t.mock.method(NGO, 'findOne', async () => ({ _id: api.ngoId, legalName: 'Example Trust' }));
  t.mock.method(Donation.prototype, 'save', async function savePledge() { return this; });

  const response = await api.post('/api/donations', {
    ngoId: api.ngoId.toString(),
    type: 'goods',
    items: [{ name: 'Blankets', quantity: 4, unit: 'pieces' }],
    pickup: { donorName: 'Test Donor', phone: '1234567890', address: '12 Main Road', city: 'Pune', state: 'Maharashtra', postalCode: '411001' }
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.donation.status, 'pledged');
  assert.equal(body.donation.items[0].name, 'Blankets');
  assert.equal(body.donation.pickup.city, 'Pune');
});

test('only an NGO account can access goods tracking updates', async t => {
  const api = await startDonationApi(t, 'individual');
  const response = await api.patch(`/api/donations/${new mongoose.Types.ObjectId()}/tracking`, {
    status: 'pickup_scheduled',
    note: 'Pickup has been scheduled'
  });
  assert.equal(response.status, 403);
});

test('goods tracking requires a meaningful note and secure completion receipt', async t => {
  const api = await startDonationApi(t, 'ngo');
  const invalidNote = await api.patch(`/api/donations/${new mongoose.Types.ObjectId()}/tracking`, {
    status: 'pickup_scheduled',
    note: '  '
  });
  assert.equal(invalidNote.status, 400);

  const missingReceipt = await api.patch(`/api/donations/${new mongoose.Types.ObjectId()}/tracking`, {
    status: 'completed',
    note: 'Items were delivered'
  });
  assert.equal(missingReceipt.status, 400);
});
