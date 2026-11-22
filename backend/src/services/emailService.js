
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

import EmailNotification from '../models/EmailNotification.js';

import { emailLayout, escapeHtml } from './emailTemplates/layout.js';
import { welcomeEmail } from './emailTemplates/welcomeEmail.js';
import { donorConfirmation } from './emailTemplates/donorConfirmation.js';
import { donationConfirmation } from './emailTemplates/donationConfirmation.js';
import { donationReceived } from './emailTemplates/donationReceived.js';
import { ngoApproval } from './emailTemplates/ngoApproval.js';
import { loginAlert } from './emailTemplates/loginAlert.js';
import { loginGreeting } from './emailTemplates/loginGreeting.js';

// Validate email addresses.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Gmail SMTP transporter.
export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Check email configuration.
export function isEmailConfigured() {
  return Boolean(
    process.env.EMAIL_USER &&
    process.env.EMAIL_APP_PASSWORD &&
    process.env.EMAIL_FROM
  );
}

export const isPasswordResetDeliveryConfigured = isEmailConfigured;

// Validate recipient.
function assertRecipient(email) {
  if (
    typeof email !== 'string' ||
    email.length > 254 ||
    !emailPattern.test(email)
  ) {
    throw new Error('A valid notification recipient email is required.');
  }
}

// Prevent duplicate notifications.
async function reserveNotification(eventKey) {
  try {
    await EmailNotification.create({
      eventKey,
      status: 'pending'
    });

    return true;
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    const existing = await EmailNotification
      .findOne({ eventKey })
      .select('status')
      .lean();

    if (!existing || existing.status !== 'failed') {
      return false;
    }

    const retry = await EmailNotification.updateOne(
      { eventKey, status: 'failed' },
      { $set: { status: 'pending' } }
    );

    return retry.modifiedCount === 1;
  }
}

// Send an email through Gmail SMTP.
export async function sendNotification({
  eventKey,
  to,
  subject,
  text,
  html
}) {
  if (
    typeof eventKey !== 'string' ||
    !eventKey ||
    eventKey.length > 200
  ) {
    throw new Error('A valid email notification event key is required.');
  }

  assertRecipient(to);

  if (!isEmailConfigured()) {
    throw new Error(
      'Gmail email delivery is not configured. Check EMAIL_USER, EMAIL_APP_PASSWORD and EMAIL_FROM.'
    );
  }

  const reserved = await reserveNotification(eventKey);

  if (!reserved) {
    return {
      sent: false,
      duplicate: true
    };
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html
    });

    try {
      await EmailNotification.updateOne(
        { eventKey, status: 'pending' },
        { $set: { status: 'sent' } }
      );
    } catch (error) {
      console.error(
        'Email delivered but notification status update failed.',
        {
          eventKey,
          error: error.message
        }
      );
    }

    return {
      sent: true,
      duplicate: false
    };

  } catch (error) {
    // Log the actual SMTP error for debugging.
    console.error('Gmail SMTP delivery error:', {
      eventKey,
      message: error.message,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      response: error.response
    });

    try {
      await EmailNotification.updateOne(
        { eventKey, status: 'pending' },
        { $set: { status: 'failed' } }
      );
    } catch (recordError) {
      console.error(
        'Email notification status update failed.',
        {
          eventKey,
          error: recordError.message
        }
      );
    }

    throw error;
  }
}

// Safely handle notification failures.
export async function dispatchNotification(options) {
  try {
    return await sendNotification(options);
  } catch (error) {
    console.error('Email notification delivery failed.', {
      eventKey: options.eventKey,
      error: error.message
    });

    return {
      sent: false,
      duplicate: false
    };
  }
}

// Welcome and donor registration emails.
export function notifyUserRegistration(user) {
  const jobs = [
    dispatchNotification({
      eventKey: `welcome:${user._id}`,
      to: user.email,
      ...welcomeEmail({
        name: user.name
      })
    })
  ];

  if (
    ['individual', 'company', 'organization'].includes(user.role)
  ) {
    jobs.push(
      dispatchNotification({
        eventKey: `donor-registration:${user._id}`,
        to: user.email,
        ...donorConfirmation({
          name: user.name,
          role: user.role
        })
      })
    );
  }

  return Promise.all(jobs);
}

// Donation created notification.
export function notifyDonationCreated({ user, donation }) {
  return dispatchNotification({
    eventKey: `donation-created:${donation._id}`,
    to: user.email,
    ...donationConfirmation({
      name: user.name,
      donation
    })
  });
}

// Donation received notification.
export function notifyDonationReceived({ user, donation }) {
  return dispatchNotification({
    eventKey: `donation-received:${donation._id}`,
    to: user.email,
    ...donationReceived({
      name: user.name,
      donation
    })
  });
}

// NGO approval or rejection notification.
export function notifyNgoDecision({
  user,
  ngo,
  decision,
  notes = '',
  eventId
}) {
  if (
    !['approved', 'rejected'].includes(decision) ||
    !user?.email
  ) {
    return Promise.resolve({
      sent: false,
      skipped: true
    });
  }

  return dispatchNotification({
    eventKey: `ngo-decision:${ngo._id}:${eventId}`,
    to: user.email,
    ...ngoApproval({
      name: user.name,
      legalName: ngo.legalName,
      decision,
      notes
    })
  });
}

// New login alert.
export function notifyNewLogin({ user, userAgent, eventId }) {
  const time = new Date().toISOString();

  return dispatchNotification({
    eventKey: `login-alert:${user._id}:${eventId}`,
    to: user.email,
    ...loginAlert({
      name: user.name,
      time,
      userAgent
    })
  });
}

// Login greeting.
export function notifyUserLogin({ user, eventId }) {
  return dispatchNotification({
    eventKey: `login-greeting:${user._id}:${eventId}`,
    to: user.email,
    ...loginGreeting({
      name: user.name
    })
  });
}

// Generate a cryptographically secure six-digit OTP.
export function generatePasswordResetOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

// New six-digit password reset OTP email.
export function sendPasswordResetOtpEmail(email, otp, eventId) {
  return sendNotification({
    eventKey: `password-reset-otp:${eventId}`,
    to: email,

    subject: 'DonationConnect - Password Reset OTP',

    text: `Your DonationConnect password reset OTP is ${otp}.

This OTP expires in 10 minutes.

If you did not request a password reset, please ignore this email.`,

    html: emailLayout({
      heading: 'Password Reset Verification',

      content: `
        <p style="line-height:1.7">
          We received a request to reset your DonationConnect password.
        </p>

        <p style="line-height:1.7">
          Your verification code is:
        </p>

        <div style="
          text-align:center;
          padding:20px;
          margin:20px 0;
          background:#f3f0ff;
          border-radius:10px;
          font-size:32px;
          font-weight:bold;
          letter-spacing:8px;
          color:#6d28d9;
        ">
          ${escapeHtml(String(otp))}
        </div>

        <p style="line-height:1.7">
          This OTP expires in <strong>10 minutes</strong>.
        </p>

        <p style="line-height:1.7">
          If you did not request this password reset, ignore this email.
        </p>
      `
    })
  });
}

// Admin review notification.
export function sendReviewEmail(
  kind,
  title,
  details,
  reviewUrl,
  eventId
) {
  const label = kind === 'ngo'
    ? 'NGO registration'
    : 'Donation request';

  return sendNotification({
    eventKey: `admin-review:${kind}:${eventId}`,

    to: process.env.ADMIN_EMAIL?.trim(),

    subject: `DonationConnect review needed: ${label}`,

    text: `${label} awaiting review: ${title}
${details}
Open the admin review desk: ${reviewUrl}`,

    html: emailLayout({
      heading: `${label} awaiting review`,

      content: `
        <p style="line-height:1.7">
          <strong>${escapeHtml(title)}</strong>
        </p>

        <p style="line-height:1.7">
          ${escapeHtml(details)}
        </p>
      `,

      actionLabel: 'Open admin review desk',
      actionUrl: reviewUrl
    })
  });
}
