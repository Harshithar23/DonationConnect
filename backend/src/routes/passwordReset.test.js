import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import bcrypt from 'bcryptjs';
import test from 'node:test';
import EmailNotification from '../models/EmailNotification.js';
import User from '../models/User.js';
import { errorHandler, notFound } from '../middleware/errors.js';
import { transporter } from '../services/emailService.js';
import authRoutes from './auth.js';

function query(value) {
  const result = {
    select() {
      return result;
    },
    lean() {
      return Promise.resolve(value);
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    }
  };
  return result;
}

async function createPasswordResetApi(t) {
  const previous = {
    jwtSecret: process.env.JWT_SECRET,
    emailUser: process.env.EMAIL_USER,
    emailAppPassword: process.env.EMAIL_APP_PASSWORD,
    emailFrom: process.env.EMAIL_FROM,
    loginAlerts: process.env.EMAIL_LOGIN_ALERTS
  };
  process.env.JWT_SECRET = 'password-reset-route-test-secret-32-characters';
  process.env.EMAIL_USER = 'donationconnect@gmail.com';
  process.env.EMAIL_APP_PASSWORD = 'test-app-password';
  process.env.EMAIL_FROM = 'DonationConnect <donationconnect@gmail.com>';
  process.env.EMAIL_LOGIN_ALERTS = 'false';
  t.after(() => {
    for (const [name, value] of Object.entries({
      JWT_SECRET: previous.jwtSecret,
      EMAIL_USER: previous.emailUser,
      EMAIL_APP_PASSWORD: previous.emailAppPassword,
      EMAIL_FROM: previous.emailFrom,
      EMAIL_LOGIN_ALERTS: previous.loginAlerts
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  const state = {
    user: {
      _id: 'reset-user',
      name: 'Reset User',
      email: 'reset@example.test',
      role: 'individual',
      status: 'active',
      passwordHash: await bcrypt.hash('old-password-value', 4),
      tokenVersion: 0,
      toJSON() {
        return { _id: this._id, email: this.email, role: this.role };
      }
    },
    sentEmails: [],
    notificationKeys: [],
    failEmail: false
  };

  t.mock.method(transporter, 'sendMail', async email => {
    if (state.failEmail) throw new Error('SMTP service unavailable');
    state.sentEmails.push(email);
    return { messageId: 'test-message' };
  });
  t.mock.method(EmailNotification, 'create', async notification => {
    state.notificationKeys.push(notification.eventKey);
    return notification;
  });
  t.mock.method(EmailNotification, 'findOne', () => ({
    select() {
      return { lean: async () => null };
    }
  }));
  t.mock.method(EmailNotification, 'updateOne', async () => ({ modifiedCount: 1 }));

  t.mock.method(User, 'findOneAndUpdate', (filter, update) => {
    if (filter.email) {
      const recentSend = state.user.resetOtpSentAt &&
        Date.now() - state.user.resetOtpSentAt.getTime() < 60_000;
      if (filter.email !== state.user.email || filter.status !== 'active' || recentSend) return query(null);
      Object.assign(state.user, update.$set);
      return query({ _id: state.user._id, email: state.user.email });
    }

    if (update.$inc?.resetOtpAttempts) {
      if (
        filter._id !== state.user._id ||
        filter.resetTokenHash !== state.user.resetTokenHash ||
        state.user.resetTokenExpiresAt <= new Date() ||
        state.user.resetOtpAttempts >= 5
      ) return query(null);
      state.user.resetOtpAttempts += 1;
      return query({ resetOtpAttempts: state.user.resetOtpAttempts });
    }

    return query(null);
  });
  t.mock.method(User, 'findOne', filter => {
    if (filter.email !== state.user.email || (filter.status && filter.status !== 'active')) return query(null);
    return query(state.user);
  });
  t.mock.method(User, 'updateOne', async (filter, update) => {
    if (update.$set?.passwordHash) {
      const eligible = filter._id === state.user._id &&
        filter.resetTokenHash === state.user.resetTokenHash &&
        state.user.resetTokenExpiresAt > new Date() &&
        state.user.resetOtpAttempts < 5;
      if (!eligible) return { modifiedCount: 0 };
      state.user.passwordHash = update.$set.passwordHash;
      state.user.tokenVersion += update.$inc.tokenVersion;
      for (const key of Object.keys(update.$unset)) delete state.user[key];
      return { modifiedCount: 1 };
    }

    if (update.$unset?.resetTokenHash) {
      if (filter.resetTokenHash !== state.user.resetTokenHash) return { modifiedCount: 0 };
      for (const key of Object.keys(update.$unset)) delete state.user[key];
      return { modifiedCount: 1 };
    }

    if (update.$set?.lastLoginFingerprint) {
      state.user.lastLoginFingerprint = update.$set.lastLoginFingerprint;
      return { modifiedCount: 1 };
    }

    return { modifiedCount: 0 };
  });

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(notFound);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));

  async function post(path, body) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  }

  return { state, post };
}

test('password reset OTP is private, rate-limited by resend cooldown, single-use, and updates login credentials', async t => {
  const { state, post } = await createPasswordResetApi(t);
  const genericMessage = 'If an active account exists for this email, a verification code will be sent.';
  const serializedUser = new User({
    name: 'Reset User',
    email: 'reset@example.test',
    passwordHash: 'password-hash',
    role: 'individual',
    resetTokenHash: 'otp-hash',
    resetTokenExpiresAt: new Date(),
    resetOtpAttempts: 1,
    resetOtpSentAt: new Date(),
    lastLoginFingerprint: 'fingerprint',
    tokenVersion: 1
  }).toJSON();
  for (const field of ['passwordHash', 'resetTokenHash', 'resetTokenExpiresAt', 'resetOtpAttempts', 'resetOtpSentAt']) {
    assert.equal(Object.hasOwn(serializedUser, field), false);
  }

  const firstRequest = await post('/forgot-password', { email: state.user.email });
  assert.equal(firstRequest.status, 200);
  assert.equal(firstRequest.body.message, genericMessage);
  assert.equal(Object.hasOwn(firstRequest.body, 'otp'), false);
  let resetEmail = state.sentEmails.find(email => /password reset otp/i.test(email.subject));
  assert.ok(resetEmail);
  let otp = resetEmail.text.match(/\b(\d{6})\b/)?.[1];
  assert.ok(otp);
  assert.equal(state.user.resetTokenHash.length, 64);
  assert.notEqual(state.user.resetTokenHash, otp);
  assert.equal(state.user.resetOtpAttempts, 0);
  assert.equal(JSON.stringify(state.user.toJSON()).includes(state.user.resetTokenHash), false);
  assert.equal(state.notificationKeys.some(key => key.includes(otp)), false);

  const cooldownRequest = await post('/forgot-password', { email: state.user.email });
  const unknownAccount = await post('/forgot-password', { email: 'missing@example.test' });
  assert.deepEqual(cooldownRequest.body, firstRequest.body);
  assert.deepEqual(unknownAccount.body, firstRequest.body);
  assert.equal(state.sentEmails.filter(email => /password reset otp/i.test(email.subject)).length, 1);

  const wrongOtp = otp === '999999' ? '000000' : '999999';
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await post('/reset-password', {
      email: state.user.email,
      otp: wrongOtp,
      password: 'new-password-value'
    });
    assert.equal(result.status, attempt === 5 ? 429 : 400);
  }
  assert.equal(state.user.resetOtpAttempts, 5);
  const lockedOut = await post('/reset-password', {
    email: state.user.email,
    otp,
    password: 'new-password-value'
  });
  assert.equal(lockedOut.status, 429);

  state.user.resetOtpSentAt = new Date(Date.now() - 61_000);
  const renewed = await post('/forgot-password', { email: state.user.email });
  assert.equal(renewed.status, 200);
  resetEmail = state.sentEmails.filter(email => /password reset otp/i.test(email.subject)).at(-1);
  otp = resetEmail.text.match(/\b(\d{6})\b/)?.[1];
  assert.ok(otp);

  state.user.resetTokenExpiresAt = new Date(Date.now() - 1_000);
  const expired = await post('/reset-password', {
    email: state.user.email,
    otp,
    password: 'new-password-value'
  });
  assert.equal(expired.status, 400);

  state.user.resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const reset = await post('/reset-password', {
    email: state.user.email,
    otp,
    password: 'new-password-value'
  });
  assert.equal(reset.status, 200);
  assert.equal(state.user.resetTokenHash, undefined);
  assert.equal(state.user.resetOtpAttempts, undefined);
  assert.equal(state.user.resetOtpSentAt, undefined);
  assert.equal(state.user.tokenVersion, 1);

  const reused = await post('/reset-password', {
    email: state.user.email,
    otp,
    password: 'another-new-password'
  });
  assert.equal(reused.status, 400);
  const oldPassword = await post('/login', {
    email: state.user.email,
    password: 'old-password-value'
  });
  assert.equal(oldPassword.status, 401);
  const newPassword = await post('/login', {
    email: state.user.email,
    password: 'new-password-value'
  });
  assert.equal(newPassword.status, 200);

  state.failEmail = true;
  state.user.resetOtpSentAt = new Date(Date.now() - 61_000);
  const deliveryFailure = await post('/forgot-password', { email: state.user.email });
  assert.equal(deliveryFailure.status, 503);
  assert.equal(state.user.resetTokenHash, undefined);
  assert.equal(state.user.resetTokenExpiresAt, undefined);
});
