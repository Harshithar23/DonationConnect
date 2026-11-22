import assert from 'node:assert/strict';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import test from 'node:test';
import { createApp } from '../app.js';
import Donation from '../models/Donation.js';
import DonationRequest from '../models/DonationRequest.js';
import EmailNotification from '../models/EmailNotification.js';
import NGO from '../models/NGO.js';
import User from '../models/User.js';
import { transporter } from '../services/emailService.js';

const mongoUri = process.env.MONGODB_TEST_URI;

function databaseNameFromUri(uri) {
  const match = uri.match(/\/([^/?]+)(?:\?|$)/);
  return match?.[1] || '';
}

async function request(baseUrl, path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { response, body: await response.json() };
}

test('real MongoDB registration, review, pledges, tracking, admin and reset workflow', { skip: !mongoUri }, async t => {
  const databaseName = databaseNameFromUri(mongoUri);
  assert.match(databaseName, /(^|[_-])test($|[_-])/i, 'MONGODB_TEST_URI must target a database whose name contains test');
  assert.notEqual(mongoUri, process.env.MONGODB_URI, 'MONGODB_TEST_URI must not equal MONGODB_URI');

  const previous = {
    nodeEnv: process.env.NODE_ENV,
    jwtSecret: process.env.JWT_SECRET,
    clientOrigin: process.env.CLIENT_ORIGIN,
    frontendUrl: process.env.FRONTEND_URL,
    emailUser: process.env.EMAIL_USER,
    emailAppPassword: process.env.EMAIL_APP_PASSWORD,
    emailFrom: process.env.EMAIL_FROM,
    adminEmail: process.env.ADMIN_EMAIL
  };
  t.after(() => {
    for (const [key, value] of Object.entries({
      NODE_ENV: previous.nodeEnv,
      JWT_SECRET: previous.jwtSecret,
      CLIENT_ORIGIN: previous.clientOrigin,
      FRONTEND_URL: previous.frontendUrl,
      EMAIL_USER: previous.emailUser,
      EMAIL_APP_PASSWORD: previous.emailAppPassword,
      EMAIL_FROM: previous.emailFrom,
      ADMIN_EMAIL: previous.adminEmail
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'isolated-integration-test-secret-32-characters-minimum';
  process.env.CLIENT_ORIGIN = 'http://localhost:5173';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  process.env.EMAIL_USER = 'integration@gmail.com';
  process.env.EMAIL_APP_PASSWORD = 'integration-app-password';
  process.env.EMAIL_FROM = 'DonationConnect <integration@gmail.com>';
  delete process.env.ADMIN_EMAIL;
  const sentEmails = [];
  t.mock.method(transporter, 'sendMail', async email => {
    sentEmails.push(email);
    return { messageId: 'integration-message' };
  });
  t.mock.method(console, 'error', () => {});

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  t.after(() => mongoose.disconnect());

  await Promise.all([
    Donation.deleteMany({}),
    DonationRequest.deleteMany({}),
    NGO.deleteMany({}),
    User.deleteMany({}),
    EmailNotification.deleteMany({})
  ]);
  t.after(async () => {
    await Promise.all([
      Donation.deleteMany({}),
      DonationRequest.deleteMany({}),
      NGO.deleteMany({}),
      User.deleteMany({}),
      EmailNotification.deleteMany({})
    ]);
  });

  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const password = 'integration-user-password';

  const register = async (email, role, additional = {}) => {
    const result = await request(baseUrl, '/auth/register', {
      method: 'POST',
      body: { name: role === 'ngo' ? 'Community NGO' : `${role} user`, email, password, role, phone: '1234567890', ...additional }
    });
    assert.equal(result.response.status, 201);
    return result.body;
  };
  const login = async (email, loginPassword = password) => {
    const result = await request(baseUrl, '/auth/login', { method: 'POST', body: { email, password: loginPassword } });
    assert.equal(result.response.status, 200);
    return result.body;
  };

  const adminUser = await User.create({
    name: 'Integration Admin',
    email: 'admin@integration.test',
    passwordHash: await bcrypt.hash('integration-admin-password', 4),
    role: 'admin'
  });
  const admin = await login(adminUser.email, 'integration-admin-password');
  const donor = await register('donor@integration.test', 'individual');
  const company = await register('company@integration.test', 'company');
  const ngoRegistration = await register('ngo@integration.test', 'ngo', {
    legalName: 'Community Trust',
    registrationType: 'trust',
    registrationNumber: 'TR-001',
    registeredAddress: '1 Community Road, Pune'
  });
  const ngo = await login('ngo@integration.test');

  const profile = await request(baseUrl, '/ngos/me', {
    method: 'PATCH',
    token: ngo.token,
    body: {
      legalName: 'Community Trust',
      registrationType: 'trust',
      registrationNumber: 'TR-001',
      registeredAddress: '1 Community Road, Pune',
      causeAreas: ['education'],
      documents: [{ kind: 'registration_certificate', fileUrl: 'https://storage.example/ngo-registration.pdf' }]
    }
  });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.body.ngo.verificationStatus, 'pending');
  assert.equal(profile.body.ngo.riskScore, 0);

  const beforeApproval = await request(baseUrl, '/requests', {
    method: 'POST',
    token: ngo.token,
    body: { title: 'School supply drive', description: 'School materials for children in the local community.', category: 'education', donationType: 'both', targetAmount: 5000, goodsNeeded: [{ item: 'Notebooks', quantity: 20 }], location: { city: 'Pune', state: 'Maharashtra', address: '1 Community Road, Pune' } }
  });
  assert.equal(beforeApproval.response.status, 403);

  const ngoDecision = await request(baseUrl, `/ngos/admin/${profile.body.ngo._id}/decision`, {
    method: 'PATCH',
    token: admin.token,
    body: { decision: 'approved', notes: 'Reviewed for integration test.' }
  });
  assert.equal(ngoDecision.response.status, 200);

  const moneyRequest = await request(baseUrl, '/requests', {
    method: 'POST',
    token: ngo.token,
    body: { title: 'School supply drive', description: 'School materials for children in the local community.', category: 'education', donationType: 'money', targetAmount: 5000, location: { city: 'Pune', state: 'Maharashtra', address: '1 Community Road, Pune' } }
  });
  const goodsRequest = await request(baseUrl, '/requests', {
    method: 'POST',
    token: ngo.token,
    body: { title: 'Winter blanket drive', description: 'Blankets for families in the local community.', category: 'shelter', donationType: 'goods', goodsNeeded: [{ item: 'Blankets', quantity: 10 }], location: { city: 'Pune', state: 'Maharashtra', address: '1 Community Road, Pune' } }
  });
  assert.equal(moneyRequest.response.status, 201);
  assert.equal(goodsRequest.response.status, 201);
  assert.equal(moneyRequest.body.request.status, 'pending');
  assert.equal((await request(baseUrl, '/requests')).body.requests.length, 0);

  for (const created of [moneyRequest.body.request, goodsRequest.body.request]) {
    const approval = await request(baseUrl, `/requests/admin/${created._id}/decision`, {
      method: 'PATCH', token: admin.token, body: { decision: 'approved' }
    });
    assert.equal(approval.response.status, 200);
  }
  const publicRequests = await request(baseUrl, '/requests');
  assert.equal(publicRequests.body.requests.length, 2);

  const moneyPledge = await request(baseUrl, '/donations', {
    method: 'POST',
    token: donor.token,
    body: { ngoId: profile.body.ngo._id, requestId: moneyRequest.body.request._id, type: 'money', amount: 1000 }
  });
  assert.equal(moneyPledge.response.status, 201);
  assert.equal(moneyPledge.body.donation.status, 'pledged');
  assert.equal(moneyPledge.body.donation.payment.method, 'pledge_only');
  assert.deepEqual(moneyPledge.body.donation.payment, { method: 'pledge_only', verificationStatus: 'not_required' });
  const duplicatePledge = await request(baseUrl, '/donations', {
    method: 'POST',
    token: donor.token,
    body: { ngoId: profile.body.ngo._id, requestId: moneyRequest.body.request._id, type: 'money', amount: 1000 }
  });
  assert.equal(duplicatePledge.response.status, 409);

  const goodsPledge = await request(baseUrl, '/donations', {
    method: 'POST',
    token: company.token,
    body: {
      ngoId: profile.body.ngo._id,
      requestId: goodsRequest.body.request._id,
      type: 'goods',
      items: [{ name: 'Blankets', quantity: 10, unit: 'pieces' }],
      pickup: { donorName: 'Company contact', phone: '1234567890', address: '20 Pickup Road', city: 'Pune', state: 'Maharashtra', postalCode: '411001' }
    }
  });
  assert.equal(goodsPledge.response.status, 201);
  const unauthorizedTracking = await request(baseUrl, `/donations/${goodsPledge.body.donation._id}/tracking`, {
    method: 'PATCH', token: donor.token, body: { status: 'pickup_scheduled', note: 'Pickup scheduled' }
  });
  assert.equal(unauthorizedTracking.response.status, 403);

  for (const [status, note, receiptUrl] of [
    ['pickup_scheduled', 'Pickup has been scheduled'],
    ['collected', 'Items collected from donor'],
    ['received', 'Items received by organization'],
    ['completed', 'Items distributed to recipients', 'https://storage.example/receipt.pdf']
  ]) {
    const update = await request(baseUrl, `/donations/${goodsPledge.body.donation._id}/tracking`, {
      method: 'PATCH', token: ngo.token, body: { status, note, ...(receiptUrl ? { receiptUrl } : {}) }
    });
    assert.equal(update.response.status, 200);
    assert.equal(update.body.donation.status, status);
  }

  const adminMetrics = await request(baseUrl, '/admin/overview', { token: admin.token });
  assert.equal(adminMetrics.response.status, 200);
  assert.equal(adminMetrics.body.metrics.usersByRole.individual, 1);
  assert.equal(adminMetrics.body.metrics.usersByRole.company, 1);
  assert.equal(adminMetrics.body.metrics.moneyPledges.amountINR, 1000);
  const donorAdminAccess = await request(baseUrl, '/admin/overview', { token: donor.token });
  assert.equal(donorAdminAccess.response.status, 403);

  const emailCountBeforeReset = sentEmails.length;
  const forgot = await request(baseUrl, '/auth/forgot-password', {
    method: 'POST', body: { email: 'donor@integration.test' }
  });
  assert.equal(forgot.response.status, 200);
  assert.equal(forgot.body.message, 'If an active account exists for this email, a verification code will be sent.');
  assert.equal(Object.hasOwn(forgot.body, 'otp'), false);
  let resetEmail = sentEmails.slice(emailCountBeforeReset).find(email => /password reset otp/i.test(email.subject));
  assert.ok(resetEmail);
  let resetOtp = resetEmail.text.match(/\b(\d{6})\b/)?.[1];
  assert.ok(resetOtp);
  const donorResetState = await User.findOne({ email: 'donor@integration.test' })
    .select('+resetTokenHash +resetTokenExpiresAt +resetOtpAttempts +resetOtpSentAt')
    .lean();
  assert.equal(donorResetState.resetTokenHash.length, 64);
  assert.notEqual(donorResetState.resetTokenHash, resetOtp);
  assert.equal(donorResetState.resetOtpAttempts, 0);
  const resendDuringCooldown = await request(baseUrl, '/auth/forgot-password', {
    method: 'POST', body: { email: 'donor@integration.test' }
  });
  assert.deepEqual(resendDuringCooldown.body, forgot.body);
  assert.equal(sentEmails.filter(email => /password reset otp/i.test(email.subject)).length, 1);

  const wrongOtp = resetOtp === '999999' ? '000000' : '999999';
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const wrongReset = await request(baseUrl, '/auth/reset-password', {
      method: 'POST',
      body: { email: 'donor@integration.test', otp: wrongOtp, password: 'updated-integration-password' }
    });
    assert.equal(wrongReset.response.status, attempt === 5 ? 429 : 400);
  }
  const lockedReset = await request(baseUrl, '/auth/reset-password', {
    method: 'POST',
    body: { email: 'donor@integration.test', otp: resetOtp, password: 'updated-integration-password' }
  });
  assert.equal(lockedReset.response.status, 429);

  await User.updateOne(
    { email: 'donor@integration.test' },
    { $set: { resetOtpSentAt: new Date(Date.now() - 61_000) } }
  );
  const renewed = await request(baseUrl, '/auth/forgot-password', {
    method: 'POST', body: { email: 'donor@integration.test' }
  });
  assert.equal(renewed.response.status, 200);
  resetEmail = sentEmails.filter(email => /password reset otp/i.test(email.subject)).at(-1);
  resetOtp = resetEmail.text.match(/\b(\d{6})\b/)?.[1];
  assert.ok(resetOtp);

  await User.updateOne(
    { email: 'donor@integration.test' },
    { $set: { resetTokenExpiresAt: new Date(Date.now() - 1_000) } }
  );
  const expiredReset = await request(baseUrl, '/auth/reset-password', {
    method: 'POST',
    body: { email: 'donor@integration.test', otp: resetOtp, password: 'updated-integration-password' }
  });
  assert.equal(expiredReset.response.status, 400);

  await User.updateOne(
    { email: 'donor@integration.test' },
    { $set: { resetTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000) } }
  );
  const reset = await request(baseUrl, '/auth/reset-password', {
    method: 'POST',
    body: { email: 'donor@integration.test', otp: resetOtp, password: 'updated-integration-password' }
  });
  assert.equal(reset.response.status, 200);
  const resetAgain = await request(baseUrl, '/auth/reset-password', {
    method: 'POST',
    body: { email: 'donor@integration.test', otp: resetOtp, password: 'another-updated-password' }
  });
  assert.equal(resetAgain.response.status, 400);
  const oldPasswordLogin = await request(baseUrl, '/auth/login', {
    method: 'POST',
    body: { email: 'donor@integration.test', password }
  });
  assert.equal(oldPasswordLogin.response.status, 401);
  const relogin = await login('donor@integration.test', 'updated-integration-password');
  const oldToken = await request(baseUrl, '/auth/me', { token: donor.token });
  assert.equal(oldToken.response.status, 401);
  assert.ok(relogin.token);
  assert.ok(ngoRegistration.user);
});
