import test from 'node:test';
import assert from 'node:assert/strict';
import EmailNotification from '../models/EmailNotification.js';
import { requestEmailReview } from './requestReview.js';
import {
  isEmailConfigured,
  notifyDonationCreated,
  notifyDonationReceived,
  notifyNewLogin,
  notifyNgoDecision,
  notifyUserLogin,
  notifyUserRegistration,
  dispatchNotification,
  sendNotification,
  sendPasswordResetOtpEmail,
  transporter
} from './emailService.js';

function configureGmail(t, sendMailImplementation = async () => ({ messageId: 'test-message' })) {
  const previous = {
    emailUser: process.env.EMAIL_USER,
    appPassword: process.env.EMAIL_APP_PASSWORD,
    from: process.env.EMAIL_FROM,
    adminEmail: process.env.ADMIN_EMAIL
  };
  process.env.EMAIL_USER = 'donationconnect@gmail.com';
  process.env.EMAIL_APP_PASSWORD = 'test-app-password';
  process.env.EMAIL_FROM = 'DonationConnect <donationconnect@gmail.com>';
  t.mock.method(transporter, 'sendMail', sendMailImplementation);
  t.after(() => {
    if (previous.emailUser === undefined) delete process.env.EMAIL_USER;
    else process.env.EMAIL_USER = previous.emailUser;
    if (previous.appPassword === undefined) delete process.env.EMAIL_APP_PASSWORD;
    else process.env.EMAIL_APP_PASSWORD = previous.appPassword;
    if (previous.from === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = previous.from;
    if (previous.adminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = previous.adminEmail;
  });
}

function mockEmailStore(t, { create, existing, update } = {}) {
  t.mock.method(EmailNotification, 'create', create || (async () => ({ status: 'pending' })));
  t.mock.method(EmailNotification, 'findOne', () => ({
    select() {
      return { lean: async () => existing || null };
    }
  }));
  t.mock.method(EmailNotification, 'updateOne', update || (async () => ({ modifiedCount: 1 })));
}

test('sends email through Gmail SMTP and records it as delivered', async t => {
  let request;
  configureGmail(t, async options => {
    request = options;
    return { messageId: 'test-message' };
  });
  const updates = [];
  mockEmailStore(t, { update: async (...args) => { updates.push(args); return { modifiedCount: 1 }; } });

  assert.equal(isEmailConfigured(), true);
  assert.deepEqual(await sendNotification({
    eventKey: 'test-event:1',
    to: 'person@example.com',
    subject: 'Test',
    text: 'Hello',
    html: '<p>Hello</p>'
  }), { sent: true, duplicate: false });
  assert.equal(request.from, process.env.EMAIL_FROM);
  assert.equal(request.to, 'person@example.com');
  assert.equal(request.subject, 'Test');
  assert.equal(updates.at(-1)[1].$set.status, 'sent');
});

test('rejects invalid recipient addresses without creating a notification', async t => {
  configureGmail(t);
  let created = false;
  mockEmailStore(t, { create: async () => { created = true; } });

  await assert.rejects(sendNotification({
    eventKey: 'invalid-recipient',
    to: 'not-an-email',
    subject: 'Test',
    text: 'Hello',
    html: '<p>Hello</p>'
  }), /valid notification recipient/);
  assert.equal(created, false);
});

test('records SMTP failures and returns an error to the caller', async t => {
  configureGmail(t, async () => { throw new Error('SMTP service unavailable'); });
  const updates = [];
  mockEmailStore(t, { update: async (...args) => { updates.push(args); return { modifiedCount: 1 }; } });

  await assert.rejects(sendNotification({
    eventKey: 'failed-event',
    to: 'person@example.com',
    subject: 'Test',
    text: 'Hello',
    html: '<p>Hello</p>'
  }), /SMTP service unavailable/);
  assert.equal(updates.at(-1)[1].$set.status, 'failed');
});

test('reports SMTP transport errors without swallowing them', async t => {
  configureGmail(t, async () => { throw new Error('Invalid login: authentication failed'); });
  mockEmailStore(t);

  await assert.rejects(sendNotification({
    eventKey: 'unverified-sender',
    to: 'person@example.com',
    subject: 'Test',
    text: 'Hello',
    html: '<p>Hello</p>'
  }), /authentication failed/);
});

test('contains delivery failures so notifications do not fail the main workflow', async t => {
  configureGmail(t, async () => { throw new Error('SMTP service unavailable'); });
  mockEmailStore(t);
  t.mock.method(console, 'error', () => {});

  assert.deepEqual(await dispatchNotification({
    eventKey: 'best-effort-event',
    to: 'person@example.com',
    subject: 'Test',
    text: 'Hello',
    html: '<p>Hello</p>'
  }), { sent: false, duplicate: false });
});

test('does not send an event that has already been delivered', async t => {
  configureGmail(t, async () => {
    throw new Error('Duplicate notification should not call SMTP.');
  });
  mockEmailStore(t, {
    create: async () => { throw Object.assign(new Error('duplicate key'), { code: 11000 }); },
    existing: { status: 'sent' }
  });

  assert.deepEqual(await sendNotification({
    eventKey: 'already-sent',
    to: 'person@example.com',
    subject: 'Test',
    text: 'Hello',
    html: '<p>Hello</p>'
  }), { sent: false, duplicate: true });
});

test('sends welcome and donor-registration emails after registration', async t => {
  const requests = [];
  configureGmail(t, async options => {
    requests.push(options);
    return { messageId: 'test-message' };
  });
  mockEmailStore(t);

  await notifyUserRegistration({ _id: 'user-1', name: 'Alex', email: 'alex@example.com', role: 'individual' });
  assert.equal(requests.length, 2);
  assert.match(requests[0].html, /Welcome, Alex!/);
  assert.match(requests[1].subject, /donor account is ready/);
});

test('sends donation confirmation and received notifications', async t => {
  const requests = [];
  configureGmail(t, async options => {
    requests.push(options);
    return { messageId: 'test-message' };
  });
  mockEmailStore(t);
  const user = { name: 'Alex', email: 'alex@example.com' };
  const donation = { _id: 'donation-1', type: 'money', amount: 500, items: [] };

  await notifyDonationCreated({ user, donation });
  await notifyDonationReceived({ user, donation });
  assert.equal(requests.length, 2);
  assert.match(requests[0].text, /donation-1/);
  assert.match(requests[0].text, /INR 500/);
  assert.match(requests[1].subject, /has been received/);
});

test('sends NGO approval notifications with next steps', async t => {
  let request;
  configureGmail(t, async options => {
    request = options;
    return { messageId: 'test-message' };
  });
  mockEmailStore(t);

  await notifyNgoDecision({
    user: { name: 'Asha', email: 'asha@example.com' },
    ngo: { _id: 'ngo-1', legalName: 'Community Trust' },
    decision: 'approved',
    eventId: 123
  });
  assert.match(request.subject, /approved/);
  assert.match(request.html, /publish donation requests/);
});

test('new-login alerts contain device information but no credentials', async t => {
  let request;
  configureGmail(t, async options => {
    request = options;
    return { messageId: 'test-message' };
  });
  mockEmailStore(t);

  await notifyNewLogin({
    user: { _id: 'user-2', name: 'Alex', email: 'alex@example.com' },
    userAgent: 'Example Browser',
    eventId: 'login-1'
  });
  assert.match(request.subject, /New sign-in/);
  assert.match(request.html, /Example Browser/);
  assert.equal(Object.hasOwn(request, 'password'), false);
  assert.equal(Object.hasOwn(request, 'token'), false);
  assert.doesNotMatch(JSON.stringify(request), /test-app-password|eyJ[a-zA-Z0-9_-]+\./);
});

test('sends a greeting email for every successful login event', async t => {
  const requests = [];
  configureGmail(t, async options => {
    requests.push(options);
    return { messageId: 'test-message' };
  });
  mockEmailStore(t);
  const user = { _id: 'user-3', name: 'Alex <script>', email: 'alex@example.com' };

  await notifyUserLogin({ user, eventId: 'login-1' });
  await notifyUserLogin({ user, eventId: 'login-2' });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].to, user.email);
  assert.match(requests[0].subject, /Good to see you again/);
  assert.match(requests[0].html, /Good to see you again, Alex &lt;script&gt;!/);
});

test('notifies administrators with a link to the admin review desk', async t => {
  let request;
  configureGmail(t, async options => {
    request = options;
    return { messageId: 'test-message' };
  });
  process.env.ADMIN_EMAIL = 'admin@example.com';
  const previousFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://example.com/';
  t.after(() => {
    if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousFrontendUrl;
  });
  mockEmailStore(t);

  await requestEmailReview('ngo', 'ngo-1', 'Community Trust', 'New NGO application', 'ngo-1');
  assert.equal(request.to, 'admin@example.com');
  assert.match(request.subject, /NGO registration/);
  assert.match(request.html, /Open admin review desk/);
  assert.match(request.text, /https:\/\/example\.com\/admin/);
  assert.doesNotMatch(request.text, /token=/);
});

test('sends the password-reset OTP without creating a reset link', async t => {
  let request;
  configureGmail(t, async options => {
    request = options;
    return { messageId: 'test-message' };
  });
  mockEmailStore(t);

  await sendPasswordResetOtpEmail('person@example.com', '012345', 'event-hash');
  assert.equal(request.to, 'person@example.com');
  assert.match(request.html, /012345/);
  assert.match(request.text, /expires in 10 minutes/);
  assert.doesNotMatch(request.text, /https?:\/\/|token=/);
});
