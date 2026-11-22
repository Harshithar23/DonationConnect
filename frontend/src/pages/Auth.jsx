import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, HeartHandshake, ShieldCheck } from 'lucide-react';
import { api, setSession } from '../lib/api.js';

const roles = [
  ['individual', 'Individual donor'],
  ['company', 'Company'],
  ['organization', 'Organization'],
  ['ngo', 'NGO / charitable trust']
];

export default function Auth({ mode = 'login' }) {
  const isRegister = mode === 'register';
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'individual',
    phone: '',
    legalName: '',
    registrationType: 'trust',
    registrationNumber: '',
    registeredAddress: ''
  });
  const [otp, setOtp] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(location.state?.message || '');
  const isOtpForm = mode === 'reset' || (mode === 'forgot' && otpSent);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setTimeout(() => setResendSeconds(seconds => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  function change(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function sendOtp() {
    const response = await api('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: form.email })
    });
    setMessage(response.message);
    setError('');
    setResendSeconds(60);
    return response;
  }

  async function resendOtp() {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await sendOtp();
      setOtp('');
      setForm(current => ({ ...current, password: '' }));
      setConfirmPassword('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'forgot' && !otpSent) {
        await sendOtp();
        setOtpSent(true);
        return;
      }

      if (isOtpForm) {
        if (!/^\d{6}$/.test(otp)) throw new Error('Enter the six-digit verification code.');
        if (form.password.length < 10 || form.password.length > 128) {
          throw new Error('Password must be between 10 and 128 characters.');
        }
        if (form.password !== confirmPassword) throw new Error('The passwords do not match.');

        const response = await api('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, otp, password: form.password })
        });
        setMessage(response.message);
        setTimeout(() => navigate('/login', {
          replace: true,
          state: { message: response.message }
        }), 1200);
        return;
      }

      if (isRegister) {
        const registration = {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          phone: form.phone.trim(),
          ...(form.role === 'ngo' ? {
            legalName: form.legalName,
            registrationType: form.registrationType,
            registrationNumber: form.registrationNumber,
            registeredAddress: form.registeredAddress
          } : {})
        };
        const response = await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify(registration)
        });
        setSession(response.token, response.user);
        navigate('/dashboard');
      } else {
        const response = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, password: form.password })
        });
        setSession(response.token, response.user);
        navigate(params.get('next') || '/dashboard');
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-photo">
        <div className="auth-photo-bg" />
        <Link to="/" className="auth-brand"><HeartHandshake size={23} /> donation<span>connect</span></Link>
        <div className="auth-photo-copy">
          <span className="eyebrow">GIVING, WITH MORE MEANING</span>
          <h1>When we come<br />together, <em>good grows.</em></h1>
          <p>Be part of a community that connects generous people with organizations doing meaningful work.</p>
          <div className="auth-photo-note"><ShieldCheck size={19} /><span>Verification first. Transparency always.</span></div>
        </div>
        <div className="auth-photo-bottom">A bridge between generosity and need.</div>
      </div>

      <div className="auth-panel">
        <Link to="/" className="back-home"><ArrowLeft size={16} /> Back to home</Link>
        <div className="auth-form-wrap">
          <div className="auth-mobile-mark"><HeartHandshake /></div>
          <div className="eyebrow eyebrow-green">
            {isRegister ? 'YOUR JOURNEY STARTS HERE' : mode === 'forgot' || mode === 'reset' ? 'ACCOUNT RECOVERY' : 'WELCOME BACK'}
          </div>
          <h2>
            {isRegister
              ? 'Make good happen.'
              : isOtpForm
                ? 'Verify your code.'
                : mode === 'forgot'
                  ? 'Reset your password.'
                  : 'Good to have you back.'}
          </h2>
          <p className="auth-subtitle">
            {isRegister
              ? 'Create your account and find your way to make a difference.'
              : isOtpForm
                ? 'Enter the six-digit code sent to your email and choose a new password.'
                : mode === 'forgot'
                  ? 'Enter your email and we will send a verification code if an active account exists.'
                  : 'Sign in to manage your giving and stay connected.'}
          </p>

          <form className="auth-form" onSubmit={submit}>
            {isRegister && (
              <>
                <label>Account type <span className="required-mark" aria-hidden="true">*</span>
                  <select name="role" value={form.role} onChange={change} required>
                    {roles.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </label>
                <label>Full name / contact name <span className="required-mark" aria-hidden="true">*</span>
                  <input name="name" value={form.name} onChange={change} required minLength="2" maxLength="120" placeholder="Your name" autoComplete="name" />
                </label>
                {form.role === 'ngo' && (
                  <>
                    <label>Legal organization name <span className="required-mark" aria-hidden="true">*</span>
                      <input name="legalName" value={form.legalName} onChange={change} required placeholder="Registered legal name" />
                    </label>
                    <div className="form-row">
                      <label>Registration type <span className="required-mark" aria-hidden="true">*</span>
                        <select required name="registrationType" value={form.registrationType} onChange={change}>
                          <option value="trust">Trust</option>
                          <option value="society">Society</option>
                          <option value="section8">Section 8 company</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label>Registration number <span className="required-mark" aria-hidden="true">*</span>
                        <input name="registrationNumber" value={form.registrationNumber} onChange={change} required placeholder="Registration ID" />
                      </label>
                    </div>
                    <label>Registered address <span className="required-mark" aria-hidden="true">*</span>
                      <textarea name="registeredAddress" value={form.registeredAddress} onChange={change} required rows="2" placeholder="Full registered address" />
                    </label>
                  </>
                )}
                <label>Phone number <span className="required-mark" aria-hidden="true">*</span>
                  <input name="phone" value={form.phone} onChange={change} required minLength="5" maxLength="25" placeholder="+91" autoComplete="tel" />
                </label>
              </>
            )}

            {(mode !== 'reset' || isOtpForm) && (
              <label>Email address <span className="required-mark" aria-hidden="true">*</span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={change}
                  required
                  readOnly={mode === 'forgot' && otpSent}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </label>
            )}

            {isOtpForm && (
              <label>Six-digit verification code <span className="required-mark" aria-hidden="true">*</span>
                <input
                  name="otp"
                  value={otp}
                  onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength="6"
                  placeholder="Enter code"
                />
              </label>
            )}

            {(isRegister || mode === 'login' || isOtpForm) && (
              <label>{isOtpForm ? 'New password' : 'Password'} <span className="required-mark" aria-hidden="true">*</span>
                <div className="password-field">
                  <input
                    type={show ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={change}
                    required
                    minLength={isRegister || isOtpForm ? 10 : 1}
                    maxLength="128"
                    autoComplete={isRegister || isOtpForm ? 'new-password' : 'current-password'}
                    placeholder={isRegister || isOtpForm ? 'At least 10 characters' : 'Enter your password'}
                  />
                  <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {isRegister && <span className="field-help">Use at least 10 characters. A unique passphrase is best.</span>}
              </label>
            )}

            {isOtpForm && (
              <label>Confirm new password <span className="required-mark" aria-hidden="true">*</span>
                <input
                  type="password"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  required
                  minLength="10"
                  maxLength="128"
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                />
              </label>
            )}

            {!isRegister && mode === 'login' && (
              <div className="forgot-row">
                <span>Secure access to your account</span>
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
            )}

            {error && <div className="form-alert" role="alert">{error}</div>}
            {message && <div className="form-success" role="status">{message}</div>}

            <button className="btn btn-primary auth-submit" disabled={loading}>
              {loading
                ? 'Please wait…'
                : mode === 'forgot' && !otpSent
                  ? 'Send OTP'
                  : isOtpForm
                    ? 'Reset password'
                    : isRegister
                      ? 'Create your account'
                      : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </form>

          {isOtpForm && (
            <p className="auth-switch">
              <button
                type="button"
                className="btn btn-light"
                onClick={resendOtp}
                disabled={loading || resendSeconds > 0}
              >
                {resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : 'Resend OTP'}
              </button>
            </p>
          )}
          {(mode === 'forgot' || mode === 'reset') && <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>}
          {mode === 'login' && <p className="auth-switch">New to DonationConnect? <Link to="/register">Create an account</Link></p>}
          {isRegister && <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>}
          <p className="auth-legal">By continuing, you agree to use the platform responsibly and provide accurate information.</p>
        </div>
      </div>
    </main>
  );
}
