
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

import User from '../models/User.js';
import NGO from '../models/NGO.js';

import { authenticate } from '../middleware/auth.js';

import {
  isPasswordResetDeliveryConfigured,
  notifyNewLogin,
  notifyUserLogin,
  notifyUserRegistration,
  sendPasswordResetOtpEmail
} from '../services/emailService.js';

import { screenNGO } from '../services/ngoScreening.js';
import { requestEmailReview } from '../services/requestReview.js';

const router = Router();

// -----------------------------------------
// VALIDATION SCHEMAS
// -----------------------------------------

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
  role: z.enum(['individual', 'company', 'organization', 'ngo']),
  phone: z.string().trim().min(5).max(25),
  legalName: z.string().trim().min(2).max(200).optional(),
  registrationType: z.enum(['trust', 'society', 'section8', 'other']).optional(),
  registrationNumber: z.string().trim().max(120).optional(),
  registeredAddress: z.string().trim().max(500).optional()
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(128)
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(25),
  profile: z.object({
    address: z.string().trim().min(5).max(500),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(3).max(20),
    website: z.string().url().or(z.literal('')).optional(),
    bio: z.string().trim().max(1000).optional(),
    avatarUrl: z.string().url().or(z.literal('')).optional()
  }).optional()
});

// -----------------------------------------
// RATE LIMITERS
// -----------------------------------------

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many password reset requests. Please try again later.'
  }
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many password reset attempts. Please try again later.'
  }
});

// -----------------------------------------
// JWT TOKEN
// -----------------------------------------

function issueToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      ver: user.tokenVersion ?? 0
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    }
  );
}

// -----------------------------------------
// REGISTER
// -----------------------------------------

router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    if (
      data.role === 'ngo' &&
      (
        !data.legalName ||
        !data.registrationType ||
        !data.registrationNumber ||
        !data.registeredAddress
      )
    ) {
      return res.status(400).json({
        message: 'NGO registration requires legal name, registration type, registration number and registered address.'
      });
    }

    const user = await User.create({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash: await bcrypt.hash(data.password, 12),
      role: data.role,
      phone: data.phone
    });

    if (data.role === 'ngo') {
      const ngo = await NGO.create({
        user: user._id,
        legalName: data.legalName,
        registrationType: data.registrationType,
        registrationNumber: data.registrationNumber,
        registeredAddress: data.registeredAddress
      });

      const existing = await NGO.find({
        _id: { $ne: ngo._id }
      })
        .select('legalName registrationNumber documents registeredAddress')
        .lean();

      const risk = screenNGO(ngo.toObject(), existing);

      ngo.riskScore = risk.score;
      ngo.riskFlags = risk.flags;

      await ngo.save();

      requestEmailReview(
        'ngo',
        ngo._id,
        ngo.legalName,
        `Submitted by ${user.name} (${user.email}); registration ${ngo.registrationType} ${ngo.registrationNumber}.`,
        ngo.createdAt.getTime()
      ).catch(error => {
        console.error('NGO review email failed:', error.message);
      });
    }

    notifyUserRegistration(user);

    res.status(201).json({
      message: 'Registration successful. Complete your profile and follow any verification steps.',
      token: issueToken(user),
      user: user.toJSON()
    });

  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid registration data.',
        details: e.issues
      });
    }

    next(e);
  }
});

// -----------------------------------------
// LOGIN
// -----------------------------------------

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Email and password are required and must be valid.'
      });
    }

    const { email, password } = parsed.data;

    const user = await User.findOne({ email })
      .select('+passwordHash +lastLoginFingerprint');

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        message: 'This account is suspended.'
      });
    }

    const fingerprint = crypto
      .createHmac('sha256', process.env.JWT_SECRET)
      .update(`${req.ip}|${req.get('user-agent') || ''}`)
      .digest('hex');

    const isNewLogin = user.lastLoginFingerprint !== fingerprint;

    User.updateOne(
      { _id: user._id },
      { $set: { lastLoginFingerprint: fingerprint } }
    ).catch(error => {
      console.error('Login fingerprint update failed:', error.message);
    });

    notifyUserLogin({
      user,
      eventId: crypto.randomUUID()
    });

    if (
      isNewLogin &&
      process.env.EMAIL_LOGIN_ALERTS === 'true'
    ) {
      notifyNewLogin({
        user,
        userAgent: req.get('user-agent'),
        eventId: `${Date.now()}-${fingerprint}`
      });
    }

    res.json({
      token: issueToken(user),
      user: user.toJSON()
    });

  } catch (e) {
    next(e);
  }
});

// -----------------------------------------
// CURRENT USER
// -----------------------------------------

router.get('/me', authenticate, async (req, res) => {
  const ngo = req.user.role === 'ngo'
    ? await NGO.findOne({ user: req.user._id }).select('-documents.fileUrl')
    : null;

  res.json({
    user: req.user,
    ngo
  });
});

// -----------------------------------------
// UPDATE PROFILE
// -----------------------------------------

router.patch('/profile', authenticate, async (req, res, next) => {
  try {
    const data = profileSchema.parse(req.body);

    if (data.name !== undefined) {
      req.user.name = data.name;
    }

    if (data.phone !== undefined) {
      req.user.phone = data.phone;
    }

    if (data.profile) {
      req.user.profile = {
        ...(req.user.profile?.toObject?.() || req.user.profile || {}),
        ...data.profile
      };
    }

    await req.user.save();

    res.json({
      user: req.user
    });

  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid profile data.',
        details: e.issues
      });
    }

    next(e);
  }
});

// -----------------------------------------
// FORGOT PASSWORD - SEND OTP
// -----------------------------------------

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  async (req, res, next) => {
    try {
      const parsed = z.object({
        email: z.string()
          .trim()
          .email()
          .max(254)
          .transform(value => value.toLowerCase())
      }).safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: 'A valid email address is required.'
        });
      }

      if (!isPasswordResetDeliveryConfigured()) {
        console.error('Password reset email configuration is missing.');

        return res.status(503).json({
          message: 'Password reset email delivery is not configured.'
        });
      }

      const otp = String(
        crypto.randomInt(0, 1_000_000)
      ).padStart(6, '0');

      const otpHash = crypto
        .createHash('sha256')
        .update(otp)
        .digest('hex');

      const now = new Date();

      const resendCutoff = new Date(
        now.getTime() - 60 * 1000
      );

      const user = await User.findOneAndUpdate(
        {
          email: parsed.data.email,
          status: 'active',
          $or: [
            { resetOtpSentAt: { $exists: false } },
            { resetOtpSentAt: null },
            { resetOtpSentAt: { $lte: resendCutoff } }
          ]
        },
        {
          $set: {
            resetTokenHash: otpHash,
            resetTokenExpiresAt: new Date(
              now.getTime() + 10 * 60 * 1000
            ),
            resetOtpAttempts: 0,
            resetOtpSentAt: now
          }
        },
        {
          new: true
        }
      ).select('email').lean();

      if (user) {
        try {
          const eventId = crypto
            .createHash('sha256')
            .update(`${user._id}:${otpHash}`)
            .digest('hex');

          await sendPasswordResetOtpEmail(
            user.email,
            otp,
            eventId
          );

          console.log('Password reset OTP email sent successfully.');

        } catch (emailError) {
          // Log the actual email failure without exposing the OTP.
          console.error('Password reset OTP email failed:', {
            message: emailError.message,
            code: emailError.code,
            command: emailError.command,
            responseCode: emailError.responseCode,
            response: emailError.response
          });

          await User.updateOne(
            {
              _id: user._id,
              resetTokenHash: otpHash
            },
            {
              $unset: {
                resetTokenHash: 1,
                resetTokenExpiresAt: 1,
                resetOtpAttempts: 1,
                resetOtpSentAt: 1
              }
            }
          );

          return res.status(503).json({
            message: 'Unable to send a password reset code right now. Please try again later.'
          });
        }
      }

      res.json({
        message: 'If an active account exists for this email, a verification code will be sent.'
      });

    } catch (e) {
      next(e);
    }
  }
);

// -----------------------------------------
// RESET PASSWORD - VERIFY OTP
// -----------------------------------------

router.post(
  '/reset-password',
  resetPasswordLimiter,
  async (req, res, next) => {
    try {
      const parsed = z.object({
        email: z.string()
          .trim()
          .email()
          .max(254)
          .transform(value => value.toLowerCase()),

        otp: z.string().regex(/^\d{6}$/),

        password: z.string().min(10).max(128)
      }).safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: 'A valid email, six-digit code, and password of 10 to 128 characters are required.',
          details: parsed.error.issues
        });
      }

      const {
        email,
        otp,
        password
      } = parsed.data;

      const now = new Date();

      const user = await User.findOne({
        email,
        status: 'active'
      })
        .select('+resetTokenHash +resetTokenExpiresAt +resetOtpAttempts')
        .lean();

      if (
        !user ||
        !user.resetTokenHash ||
        !user.resetTokenExpiresAt ||
        user.resetTokenExpiresAt <= now
      ) {
        return res.status(400).json({
          message: 'The verification code is invalid or expired. Request a new code.'
        });
      }

      if ((user.resetOtpAttempts ?? 0) >= 5) {
        return res.status(429).json({
          message: 'Too many incorrect codes. Request a new verification code.'
        });
      }

      const submittedHash = crypto
        .createHash('sha256')
        .update(otp)
        .digest();

      const storedHash = /^[a-f\d]{64}$/i.test(user.resetTokenHash)
        ? Buffer.from(user.resetTokenHash, 'hex')
        : Buffer.alloc(0);

      const otpMatches =
        storedHash.length === submittedHash.length &&
        crypto.timingSafeEqual(submittedHash, storedHash);

      if (!otpMatches) {
        const failedAttempt = await User.findOneAndUpdate(
          {
            _id: user._id,
            status: 'active',
            resetTokenHash: user.resetTokenHash,
            resetTokenExpiresAt: { $gt: new Date() },
            resetOtpAttempts: { $lt: 5 }
          },
          {
            $inc: {
              resetOtpAttempts: 1
            }
          },
          {
            new: true
          }
        ).select('+resetOtpAttempts').lean();

        if (failedAttempt?.resetOtpAttempts >= 5) {
          return res.status(429).json({
            message: 'Too many incorrect codes. Request a new verification code.'
          });
        }

        return res.status(400).json({
          message: 'The verification code is incorrect.'
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const result = await User.updateOne(
        {
          _id: user._id,
          status: 'active',
          resetTokenHash: user.resetTokenHash,
          resetTokenExpiresAt: { $gt: new Date() },
          resetOtpAttempts: { $lt: 5 }
        },
        {
          $set: {
            passwordHash
          },
          $unset: {
            resetTokenHash: 1,
            resetTokenExpiresAt: 1,
            resetOtpAttempts: 1,
            resetOtpSentAt: 1
          },
          $inc: {
            tokenVersion: 1
          }
        }
      );

      if (result.modifiedCount !== 1) {
        return res.status(400).json({
          message: 'The verification code is invalid or expired. Request a new code.'
        });
      }

      res.json({
        message: 'Password updated. Please sign in.'
      });

    } catch (e) {
      next(e);
    }
  }
);

export default router;
