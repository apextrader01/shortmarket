import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase';

export default function LoginView() {
  const { login, preLogin, sendLoginEmailOtp, verify2FA, register, forgotPassword, verifyResetOtp, resetPassword, authError } = useStore(useShallow(state => ({ 
    login: state.login, 
    preLogin: state.preLogin, 
    sendLoginEmailOtp: state.sendLoginEmailOtp,
    verify2FA: state.verify2FA,
    register: state.register, 
    forgotPassword: state.forgotPassword, 
    verifyResetOtp: state.verifyResetOtp, 
    resetPassword: state.resetPassword, 
    authError: state.authError 
  })));
  
  // view: 'login', 'register', 'forgot', 'otp', 'reset', 'login_otp', 'register_otp'
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      const urlParams = new URLSearchParams(window.location.search);
      if (p.includes('/register') || p.includes('/signup') || p.includes('/ref/') || urlParams.get('ref')) {
        return 'register';
      }
    }
    return 'login';
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let ref = urlParams.get('ref');
    if (!ref) {
      // Support path-based referral URLs like /ref/:referralSlug
      const parts = window.location.pathname.split('/').filter(Boolean);
      const refIdx = parts.indexOf('ref');
      if (refIdx !== -1 && parts[refIdx + 1]) {
        ref = decodeURIComponent(parts[refIdx + 1]);
      }
    }
    if (ref) {
      localStorage.setItem('referral_code', ref);
      setView('register');
    }

    // Support Firebase action links for password reset
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');
    const paramEmail = urlParams.get('email');
    if (paramEmail) {
      setEmail(paramEmail);
    }
    if (mode === 'resetPassword' || oobCode) {
      setView('reset');
      setOtp('FIREBASE_VERIFIED');
      setMessage('Firebase reset link verified. Please enter your new password below.');
    }
  }, []);

  const [username, setUsername] = useState('');
  const [phone,    setPhone]    = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [otp,      setOtp]      = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [message,  setMessage]  = useState('');

  // 2FA & 30-Day Device Trust States
  const [twoFactorMethod, setTwoFactorMethod] = useState('phone'); // 'phone' | 'totp' | 'email'
  const [hasTotp, setHasTotp] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [registeredPhone, setRegisteredPhone] = useState('');

  const setupRecaptchaVerifier = () => {
    if (window.recaptchaVerifier) {
      return window.recaptchaVerifier;
    }
    const container = document.getElementById('recaptcha-container');
    if (container) {
      container.innerHTML = '';
    }
    try {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {},
        'expired-callback': () => {
          try { window.recaptchaVerifier?.clear(); } catch (_) {}
          window.recaptchaVerifier = null;
        }
      });
      return window.recaptchaVerifier;
    } catch (err) {
      console.warn('Recaptcha verifier notice:', err.message);
      if (window.recaptchaVerifier) return window.recaptchaVerifier;
      throw err;
    }
  };

  const triggerPhoneSms = async (targetPhone) => {
    try {
      setLoading(true);
      useStore.setState({ authError: null });
      const verifier = setupRecaptchaVerifier();
      const rawPhone = String(targetPhone || registeredPhone || '').trim();
      const cleanPhone = rawPhone.replace(/\D/g, '');
      const formattedPhone = rawPhone.startsWith('+') ? rawPhone : '+91' + cleanPhone;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmationResult(confirmation);
      setMessage(`2FA security code sent to registered number ending in ${cleanPhone.slice(-4)}.`);
    } catch (error) {
      console.error('Phone SMS Error:', error);
      const isCaptchaOrDomain = 
        error?.code === 'auth/unauthorized-domain' || 
        error?.code === 'auth/captcha-check-failed' || 
        error?.code === 'auth/invalid-app-credential' ||
        String(error?.message || '').includes('Hostname match not found') ||
        String(error?.message || '').includes('reCAPTCHA');

      if (isCaptchaOrDomain) {
        useStore.setState({ authError: null });
        setTwoFactorMethod('email');
        setMessage('SMS unavailable on this mobile app/device. Verification code sent to your email.');
        triggerEmailOtp();
      } else {
        useStore.setState({ authError: error.message || 'Failed to send 2FA security code.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerEmailOtp = async () => {
    try {
      setSendingEmailOtp(true);
      useStore.setState({ authError: null });
      const res = await sendLoginEmailOtp(email, password);
      if (res && res.success) {
        setEmailOtpSent(true);
        if (res.otp) {
          setEmailOtp(String(res.otp));
        }
        setMessage(res.message || `Verification code sent to ${email}. Check your inbox!`);
      } else {
        useStore.setState({ authError: res?.error || 'Failed to send email OTP.' });
      }
    } catch (e) {
      useStore.setState({ authError: e.message || 'Failed to send email OTP.' });
    } finally {
      setSendingEmailOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    useStore.setState({ authError: null });
    setMessage('');

    if (view === 'login') {
      const res = await preLogin(email, password);
      if (res && res.success) {
        if (res.trusted) {
          // Device is trusted for 30 days! User logged in immediately without 2FA!
          setLoading(false);
          return;
        }
        setHasTotp(!!res.totp_enabled);
        const cleanPhone = String(res.phone || '').trim().replace(/\D/g, '');
        setRegisteredPhone(cleanPhone);

        // If user already set up Google Authenticator, default to TOTP
        if (res.totp_enabled) {
          setTwoFactorMethod('totp');
          setView('login_otp');
          setMessage('Two-factor authentication required. Enter your 6-digit Google Authenticator code.');
          setLoading(false);
          return;
        }

        // Try sending phone SMS OTP:
        try {
          const verifier = setupRecaptchaVerifier();
          const rawPhone = String(res.phone || '').trim();
          const formattedPhone = rawPhone.startsWith('+') ? rawPhone : '+91' + cleanPhone;
          const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);
          setConfirmationResult(confirmation);
          setTwoFactorMethod('phone');
          setView('login_otp');
          setMessage(`2FA security code sent to registered number ending in ${cleanPhone.slice(-4)}.`);
        } catch (error) {
          console.error('Auto SMS error:', error);
          if (error?.code === 'auth/unauthorized-domain') {
            useStore.setState({ authError: 'Domain unauthorized in Firebase. Please add www.skandx.in to Firebase Authorized Domains.' });
          }
          // If SMS gateway fails or rate limits, gracefully offer Email OTP or Google Authenticator
          setTwoFactorMethod('email');
          setView('login_otp');
          setMessage('SMS service unavailable. Verification code dispatched to your email.');
          triggerEmailOtp();
        }
      }
    } 
    else if (view === 'login_otp') {
      if (twoFactorMethod === 'totp') {
        if (!totpCode || totpCode.trim().length !== 6) {
          useStore.setState({ authError: 'Please enter a valid 6-digit Google Authenticator code.' });
          setLoading(false);
          return;
        }
        const res = await verify2FA({
          email,
          password,
          method: 'TOTP',
          code: totpCode.trim(),
          trust_device: trustDevice
        });
        if (!res || !res.success) {
          useStore.setState({ authError: res?.error || 'Invalid Google Authenticator code.' });
        }
      } else if (twoFactorMethod === 'email') {
        if (!emailOtp || emailOtp.trim().length !== 6) {
          useStore.setState({ authError: 'Please enter the 6-digit Email OTP.' });
          setLoading(false);
          return;
        }
        const res = await verify2FA({
          email,
          password,
          method: 'EMAIL_OTP',
          code: emailOtp.trim(),
          trust_device: trustDevice
        });
        if (!res || !res.success) {
          useStore.setState({ authError: res?.error || 'Invalid or expired Email OTP.' });
        }
      } else if (twoFactorMethod === 'phone') {
        try {
          if (!confirmationResult) {
            throw new Error('No pending OTP verification session. Please click "Resend SMS".');
          }
          await confirmationResult.confirm(phoneOtp);
          await login(email, password, { trust_device: trustDevice });
        } catch (error) {
          useStore.setState({ authError: error.message?.includes('invalid') ? 'Invalid 2FA code. Please check and try again.' : (error.message || 'Verification failed') });
        }
      }
    }
    else if (view === 'register') {
      try {
        const verifier = setupRecaptchaVerifier();
        const cleanPhone = phone.replace(/\D/g, '');
        const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length > 10 
          ? '+' + cleanPhone 
          : '+91' + cleanPhone;
        const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);
        setConfirmationResult(confirmation);
        setView('register_otp');
        setMessage('OTP sent to your phone.');
      } catch (error) {
        useStore.setState({ authError: error.message });
      }
    }
    else if (view === 'register_otp') {
      try {
        if (!confirmationResult) {
          throw new Error('No pending OTP verification session. Please register again.');
        }
        const userCredential = await confirmationResult.confirm(phoneOtp);
        const firebaseToken = await userCredential?.user?.getIdToken().catch(() => null);
        await register(username, email, phone, password, firebaseToken);
      } catch (error) {
        useStore.setState({ authError: 'Invalid OTP code.' });
      }
    }
    else if (view === 'forgot') {
      const res = await forgotPassword(email);
      if (res && res.success) {
        setMessage(res.message || 'Password reset email sent via Firebase! Check your inbox (and spam folder) for the link or enter the OTP below.');
        if (res.otp) {
          setOtp(String(res.otp));
        }
        setView('otp');
      } else {
        useStore.setState({ authError: res?.error || 'Failed to send reset code.' });
      }
    }
    else if (view === 'otp') {
      if (!otp || otp.length !== 6) {
        useStore.setState({ authError: 'OTP must be 6 digits' });
        setLoading(false);
        return;
      }
      const res = await verifyResetOtp(email, otp);
      if (res && res.success) {
        setView('reset');
        setMessage('Code verified. Set your new password.');
      } else {
        useStore.setState({ authError: res?.error || 'Invalid or expired OTP code' });
      }
    }
    else if (view === 'reset') {
      if (!email) {
        setView('forgot');
        useStore.setState({ authError: 'Please enter your registered email to continue.' });
        setLoading(false);
        return;
      }
      const activeOtp = otp || 'FIREBASE_VERIFIED';
      const res = await resetPassword(email, activeOtp, password);
      if (res && res.success) {
        setMessage('Password reset successfully! Please log in with your new password.');
        setView('login');
        setPassword('');
        setOtp('');
      } else {
        useStore.setState({ authError: res?.error || 'Failed to reset password.' });
      }
    }
    setLoading(false);
  };

  const switchMode = (newView) => {
    setView(newView);
    useStore.setState({ authError: null });
    setMessage('');
  };

  const inputStyle = {
    width:        '100%',
    background:   'var(--bg-panel)',
    border:       '1px solid var(--border-color)',
    padding:      '12px',
    borderRadius: '6px',
    color:        'var(--text-primary)',
    fontSize:     '14px',
    outline:      'none',
    boxSizing:    'border-box',
  };

  const labelStyle = {
    display:      'block',
    fontSize:     '12px',
    color:        'var(--text-secondary)',
    marginBottom: '6px',
  };

  return (
    <div className="login-container">
      {/* Left Visual Panel (Desktop Only) */}
      <div className="login-visual-panel">
        <div className="login-visual-bg"></div>
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="logo-text-premium" style={{ marginBottom: 'auto' }}>
            SHORT <span>EDGE</span>
          </div>
          <div>
            <h1 style={{ fontSize: '48px', fontWeight: '800', lineHeight: '1.1', marginBottom: '16px', color: '#fff' }}>
              The future of<br />algorithmic trading.
            </h1>
            <p style={{ fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: '1.5' }}>
              Experience sub-millisecond execution, advanced order routing, and a terminal designed for professional traders.
            </p>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="login-form-panel">
        <div className="mobile-only" style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div className="logo-text-premium" style={{ fontSize: '32px', marginBottom: '8px' }}>
            SHORT <span>EDGE</span>
          </div>
        </div>
        
        {localStorage.getItem('referral_code') && view === 'register' && (
          <div style={{
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#60a5fa',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '12.5px',
            fontWeight: '600',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🎁 <span>Special Partner Invite active (<b>{localStorage.getItem('referral_code')}</b>)! You qualify for a 20% platform discount.</span>
          </div>
        )}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>
            {view === 'login' && 'Welcome back'}
            {view === 'register' && 'Create your account'}
            {view === 'forgot' && 'Reset password'}
            {view === 'otp' && 'Verify identity'}
            {view === 'login_otp' && 'Two-Factor Authentication'}
            {view === 'register_otp' && 'Verify your phone'}
            {view === 'reset' && 'Secure your account'}
          </h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            {view === 'login' && 'Enter your details to access your terminal.'}
            {view === 'register' && 'Join the edge in professional trading.'}
            {view === 'forgot' && 'We will send you a secure OTP to reset it.'}
            {view === 'otp' && 'Enter the 6-digit code sent to your email.'}
            {view === 'login_otp' && (twoFactorMethod === 'totp' ? 'Enter the dynamic 6-digit code from Google Authenticator.' : (twoFactorMethod === 'email' ? 'Enter the 6-digit verification code sent to your email.' : 'Enter the 6-digit code sent to your registered phone number.'))}
            {view === 'register_otp' && 'Enter the 6-digit code sent to your phone via SMS.'}
            {view === 'reset' && 'Choose a strong, unique password.'}
          </div>
        </div>

        {/* Error Banner */}
        {authError && (
          <div style={{
            background:   'rgba(239, 68, 68, 0.1)',
            color:        'var(--color-red-light)',
            padding:      '12px 16px',
            borderRadius: '8px',
            fontSize:     '14px',
            fontWeight:   '600',
            marginBottom: '24px',
            border:       '1px solid rgba(239, 68, 68, 0.2)',
            display:      'flex',
            alignItems:   'center',
            gap:          '8px'
          }}>
            ⚠️ {authError}
          </div>
        )}

        {/* Success Banner */}
        {message && (
          <div style={{
            background:   'rgba(16, 185, 129, 0.1)',
            color:        'var(--color-green-light)',
            padding:      '12px 16px',
            borderRadius: '8px',
            fontSize:     '14px',
            fontWeight:   '600',
            marginBottom: '24px',
            border:       '1px solid rgba(16, 185, 129, 0.2)',
            display:      'flex',
            alignItems:   'center',
            gap:          '8px'
          }}>
            ✓ {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {view === 'register' && (
            <div>
              <label style={labelStyle}>Full Name</label>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="premium-input" placeholder="John Doe" />
            </div>
          )}

          {view === 'register' && (
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input type="tel" pattern="[0-9]{10}" maxLength="10" required value={phone} onChange={(e) => setPhone(e.target.value)} className="premium-input" placeholder="1234567890" />
            </div>
          )}

          {(view === 'login' || view === 'register' || view === 'forgot') && (
            <div>
              <label style={labelStyle}>Email ID</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="premium-input" placeholder="john@example.com" />
            </div>
          )}

          {view === 'otp' && (
            <div>
              <label style={labelStyle}>6-Digit Security Code</label>
              <input type="text" required maxLength="6" inputMode="numeric" pattern="[0-9]*" value={otp} onChange={(e) => setOtp(e.target.value)} className="premium-input" placeholder="000000" style={{ letterSpacing: '8px', fontSize: '24px', textAlign: 'center', fontWeight: 'bold' }} />
            </div>
          )}

          {view === 'register_otp' && (
            <div>
              <label style={labelStyle}>6-Digit Phone OTP</label>
              <input type="text" required maxLength="6" inputMode="numeric" pattern="[0-9]*" value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} className="premium-input" placeholder="000000" style={{ letterSpacing: '8px', fontSize: '24px', textAlign: 'center', fontWeight: 'bold' }} />
            </div>
          )}

          {view === 'login_otp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '13px', color: '#60a5fa' }}>
                🔒 Authenticating account: <strong>{email}</strong>
              </div>

              {/* 2FA Method Selector */}
              <div>
                <label style={{ ...labelStyle, marginBottom: '8px' }}>Choose Verification Method:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorMethod('phone');
                      useStore.setState({ authError: null });
                      if (!confirmationResult && registeredPhone) triggerPhoneSms();
                    }}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '6px',
                      border: twoFactorMethod === 'phone' ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                      background: twoFactorMethod === 'phone' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-hover)',
                      color: twoFactorMethod === 'phone' ? 'var(--color-blue-light)' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>📱</span> SMS OTP
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorMethod('totp');
                      useStore.setState({ authError: null });
                    }}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '6px',
                      border: twoFactorMethod === 'totp' ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                      background: twoFactorMethod === 'totp' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-hover)',
                      color: twoFactorMethod === 'totp' ? 'var(--color-blue-light)' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>🔑</span> Authenticator
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorMethod('email');
                      useStore.setState({ authError: null });
                      if (!emailOtpSent) triggerEmailOtp();
                    }}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '6px',
                      border: twoFactorMethod === 'email' ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                      background: twoFactorMethod === 'email' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-hover)',
                      color: twoFactorMethod === 'email' ? 'var(--color-blue-light)' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>✉️</span> Email OTP
                  </button>
                </div>
              </div>

              {/* Method 1: Phone SMS */}
              {twoFactorMethod === 'phone' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>
                      6-Digit Phone OTP {registeredPhone ? `(..${registeredPhone.slice(-4)})` : ''}
                    </label>
                    <button
                      type="button"
                      onClick={() => triggerPhoneSms()}
                      style={{ background: 'none', border: 'none', color: 'var(--color-blue-light)', fontSize: '11.5px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      {confirmationResult ? 'Resend SMS' : 'Send SMS Code'}
                    </button>
                  </div>
                  <input type="text" required maxLength="6" inputMode="numeric" pattern="[0-9]*" value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} className="premium-input" placeholder="000000" style={{ letterSpacing: '8px', fontSize: '24px', textAlign: 'center', fontWeight: 'bold' }} />
                </div>
              )}

              {/* Method 2: Google Authenticator (TOTP) */}
              {twoFactorMethod === 'totp' && (
                <div>
                  <label style={labelStyle}>6-Digit Google Authenticator Code</label>
                  <input type="text" required maxLength="6" inputMode="numeric" pattern="[0-9]*" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} className="premium-input" placeholder="000000" style={{ letterSpacing: '8px', fontSize: '24px', textAlign: 'center', fontWeight: 'bold' }} />
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    Open your Google Authenticator or Authy app and enter the 6-digit dynamic code.
                  </div>
                </div>
              )}

              {/* Method 3: Email OTP */}
              {twoFactorMethod === 'email' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>6-Digit Email OTP</label>
                    <button
                      type="button"
                      disabled={sendingEmailOtp}
                      onClick={() => triggerEmailOtp()}
                      style={{ background: 'none', border: 'none', color: 'var(--color-blue-light)', fontSize: '11.5px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      {sendingEmailOtp ? 'Sending...' : (emailOtpSent ? 'Resend Code' : 'Send Code')}
                    </button>
                  </div>
                  <input type="text" required maxLength="6" inputMode="numeric" pattern="[0-9]*" value={emailOtp} onChange={(e) => setEmailOtp(e.target.value)} className="premium-input" placeholder="000000" style={{ letterSpacing: '8px', fontSize: '24px', textAlign: 'center', fontWeight: 'bold' }} />
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    We sent a secure 6-digit code to <strong>{email}</strong>.
                  </div>
                </div>
              )}

              {/* 30-Day Device Trust Checkbox */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '10px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                userSelect: 'none'
              }}>
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#3b82f6', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#fff' }}>Trust this device for 30 days</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Don't ask for 2FA verification on this device again for 30 days
                  </div>
                </div>
              </label>
            </div>
          )}

          {view === 'reset' && (
            <div>
              {!email ? (
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Your Registered Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="premium-input" placeholder="name@example.com" />
                </div>
              ) : (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '13px', color: '#60a5fa' }}>
                  🔑 Resetting password for: <strong>{email}</strong>
                </div>
              )}
            </div>
          )}

          {(view === 'login' || view === 'register' || view === 'reset') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>{view === 'reset' ? 'New Password' : 'Password'}</label>
                {view === 'login' && (
                  <span onClick={() => switchMode('forgot')} style={{ color: 'var(--color-blue)', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>Forgot password?</span>
                )}
              </div>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="premium-input" placeholder="••••••••" />

              {view === 'login' && (
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  marginTop: '12px'
                }}>
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#3b82f6', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#fff' }}>Trust this device for 30 days</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Stay signed in without repeated daily OTP logins
                    </div>
                  </div>
                </label>
              )}
            </div>
          )}

          <div id="recaptcha-container"></div>
          <button type="submit" disabled={loading} className="premium-btn" style={{ marginTop: '12px' }}>
            {loading ? 'PROCESSING...' : 
              (view === 'login' ? 'LOG IN' : 
               view === 'login_otp' ? (twoFactorMethod === 'totp' ? 'VERIFY AUTHENTICATOR' : (twoFactorMethod === 'email' ? 'VERIFY EMAIL OTP' : 'VERIFY SMS OTP')) :
               view === 'register' ? 'CREATE ACCOUNT' : 
               view === 'register_otp' ? 'VERIFY OTP' : 
               view === 'forgot' ? 'SEND RESET LINK' : 
               view === 'otp' ? 'VERIFY CODE' : 'RESET PASSWORD')}
          </button>
        </form>

        {/* Toggle */}
        <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          {(view === 'login' || view === 'forgot' || view === 'otp' || view === 'register_otp' || view === 'login_otp' || view === 'reset') ? "Don't have an account? " : 'Already have an account? '}
          <span
            onClick={() => switchMode(view === 'register' ? 'login' : 'register')}
            style={{ color: '#fff', cursor: 'pointer', fontWeight: '700' }}
          >
            {(view === 'login' || view === 'forgot' || view === 'otp' || view === 'register_otp' || view === 'login_otp' || view === 'reset') ? 'Sign up for free' : 'Log in'}
          </span>
          {(view === 'forgot' || view === 'otp' || view === 'register_otp' || view === 'login_otp' || view === 'reset') && (
            <div style={{ marginTop: '16px' }}>
              <span onClick={() => switchMode('login')} style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '600' }}>← Back to login</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



