import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase';

export default function LoginView() {
  const { login, preLogin, sendLoginEmailOtp, verify2FA, register, sendRegistrationOtp, forgotPassword, verifyResetOtp, resetPassword, authError } = useStore(useShallow(state => ({ 
    login: state.login, 
    preLogin: state.preLogin, 
    sendLoginEmailOtp: state.sendLoginEmailOtp,
    verify2FA: state.verify2FA,
    register: state.register, 
    sendRegistrationOtp: state.sendRegistrationOtp,
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
      if (oobCode) {
        setOtp(oobCode);
      }
      setMessage('Password reset link detected. Please enter your new password below.');
    }
  }, []);

  const [username, setUsername] = useState('');
  const [phone,    setPhone]    = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [otp,      setOtp]      = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [registerOtpMethod,  setRegisterOtpMethod]  = useState('phone'); // 'phone' | 'email'
  const [sendingRegOtp,     setSendingRegOtp]     = useState(false);
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
  
  // Consent & DPDP States (Explicit Unticked Opt-Ins)
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentDataProcessing, setConsentDataProcessing] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);

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
      useStore.setState({ authError: null });
      setTwoFactorMethod('email');
      setMessage('SMS verification is unavailable on this browser. A 6-digit verification code was sent to your email.');
      triggerEmailOtp();
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
        setEmailOtp('');
        setMessage(res.message || `Verification code sent to ${email}. Check your email inbox!`);
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
          useStore.setState({ authError: null });
          setTwoFactorMethod('email');
          setView('login_otp');
          setMessage('SMS verification is unavailable on this browser. A 6-digit verification code was sent to your email.');
          triggerEmailOtp();
        }
      } else {
        useStore.setState({ authError: res?.error || 'Invalid email or password. Please check your credentials.' });
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
      const cleanPhone = String(phone || '').replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        useStore.setState({ authError: 'Please enter a valid 10-digit mobile phone number.' });
        setLoading(false);
        return;
      }
      if (!username.trim()) {
        useStore.setState({ authError: 'Please enter your full name.' });
        setLoading(false);
        return;
      }
      if (!email.trim()) {
        useStore.setState({ authError: 'Please enter a valid email address.' });
        setLoading(false);
        return;
      }
      if (!password || password.length < 6) {
        useStore.setState({ authError: 'Password must be at least 6 characters long.' });
        setLoading(false);
        return;
      }
      if (!consentTerms) {
        useStore.setState({ authError: 'Please check the box to agree to the Terms of Service and Privacy Notice.' });
        setLoading(false);
        return;
      }
      if (!consentDataProcessing) {
        useStore.setState({ authError: 'Please check the box to consent to Personal Data Processing to register.' });
        setLoading(false);
        return;
      }

      // Try Phone SMS first via Firebase, fallback to high-reliability Email OTP
      try {
        const verifier = setupRecaptchaVerifier();
        const formattedPhone = '+91' + cleanPhone;
        const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);
        setConfirmationResult(confirmation);
        setRegisterOtpMethod('phone');
        setView('register_otp');
        setMessage(`6-digit SMS verification code dispatched to +91 ${cleanPhone}.`);
      } catch (error) {
        console.warn('Phone SMS registration error, falling back to Email OTP:', error);
        const res = await sendRegistrationOtp(username.trim(), email.trim().toLowerCase(), cleanPhone);
        if (res && res.success) {
          setRegisterOtpMethod('email');
          setView('register_otp');
          setMessage(res.message || `Verification code sent to ${email.trim().toLowerCase()}. Check your email inbox!`);
        } else {
          useStore.setState({ authError: res?.error || 'Failed to dispatch verification code. Please check your details.' });
        }
      }
    }
    else if (view === 'register_otp') {
      const cleanPhone = String(phone || '').replace(/\D/g, '');
      const cleanOtp = String(phoneOtp || '').trim();
      if (!cleanOtp || cleanOtp.length !== 6) {
        useStore.setState({ authError: 'Please enter a valid 6-digit verification code.' });
        setLoading(false);
        return;
      }

      const consentsPayload = { terms: consentTerms, dataProcessing: consentDataProcessing, marketing: consentMarketing };

      if (registerOtpMethod === 'phone' && confirmationResult) {
        try {
          const userCredential = await confirmationResult.confirm(cleanOtp);
          const firebaseToken = await userCredential?.user?.getIdToken().catch(() => null);
          const res = await register(username.trim(), email.trim().toLowerCase(), cleanPhone, password, firebaseToken, null, consentsPayload);
          if (res && !res.success) {
            useStore.setState({ authError: res.error || 'Registration failed' });
          }
        } catch (error) {
          console.warn('Firebase SMS confirm failed, attempting Email OTP validation:', error);
          const res = await register(username.trim(), email.trim().toLowerCase(), cleanPhone, password, null, cleanOtp, consentsPayload);
          if (res && !res.success) {
            useStore.setState({ authError: error.message?.includes('invalid') ? 'Invalid verification code. Please check and try again.' : (res.error || 'Verification failed') });
          }
        }
      } else {
        const res = await register(username.trim(), email.trim().toLowerCase(), cleanPhone, password, null, cleanOtp, consentsPayload);
        if (res && !res.success) {
          useStore.setState({ authError: res.error || 'Invalid or expired verification code. Please request a new code.' });
        }
      }
    }
    else if (view === 'forgot') {
      const res = await forgotPassword(email);
      if (res && res.success) {
        setMessage(res.message || 'Password reset email sent! Check your inbox (and spam folder) for the verification code.');
        setOtp('');
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
      if (!otp) {
        useStore.setState({ authError: 'Missing OTP or reset verification code. Please request a new link.' });
        setLoading(false);
        return;
      }
      const res = await resetPassword(email, otp, password);
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
          <div className="logo-text-premium" style={{ marginBottom: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/pwa-192x192.png" alt="SkandX" style={{ width: '38px', height: '38px', borderRadius: '10px', boxShadow: '0 0 16px rgba(56, 189, 248, 0.45)' }} />
            <span>Skand<span>X</span></span>
          </div>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '11.5px',
              fontWeight: '700',
              color: '#38bdf8',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '16px'
            }}>
              ⚡ India's #1 Real-Time Paper Trading & Algo Terminal
            </div>
            <h1 style={{ fontSize: '44px', fontWeight: '900', lineHeight: '1.15', marginBottom: '16px', color: '#fff', letterSpacing: '-1px' }}>
              Trade the markets.<br />
              <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                100% Risk-Free.
              </span>
            </h1>
            <p style={{ fontSize: '15.5px', color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: '1.6', marginBottom: '24px' }}>
              India's fastest real-time stock & options demo simulator. Practice with live NSE/BSE ticks, option chains with Greeks, bracket orders, and customizable demo capital from ₹10 Lakh to ₹10 Crore.
            </p>

            {/* Feature Highlights Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxWidth: '420px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#10b981' }}>✔</span> Real-Time NSE / BSE Feeds
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#10b981' }}>✔</span> Live Options with Greeks
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#10b981' }}>✔</span> ₹10L to ₹10Cr Demo Funds
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#10b981' }}>✔</span> Sub-MS Algo Engine
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="login-form-panel">
        <div className="mobile-only" style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div className="logo-text-premium" style={{ fontSize: '32px', marginBottom: '6px', display: 'inline-flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
            <img src="/pwa-192x192.png" alt="SkandX" style={{ width: '36px', height: '36px', borderRadius: '9px', boxShadow: '0 0 14px rgba(56, 189, 248, 0.45)' }} />
            <span>Skand<span>X</span></span>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#38bdf8' }}>
            India's #1 Real-Time Paper Trading & Algo Terminal
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
            🎁 <span>Special Partner Invite active (<b>{localStorage.getItem('referral_code')}</b>)! You qualify for a 10% platform discount.</span>
          </div>
        )}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>
            {view === 'login' && 'Welcome back'}
            {view === 'register' && 'Create your account'}
            {view === 'forgot' && 'Reset password'}
            {view === 'otp' && 'Verify identity'}
            {view === 'login_otp' && 'Two-Factor Authentication'}
            {view === 'register_otp' && 'Verify your account'}
            {view === 'reset' && 'Secure your account'}
          </h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            {view === 'login' && 'Enter your details to access your terminal.'}
            {view === 'register' && 'Join the edge in professional trading.'}
            {view === 'forgot' && 'We will send you a secure OTP to reset it.'}
            {view === 'otp' && 'Enter the 6-digit code sent to your email.'}
            {view === 'login_otp' && (twoFactorMethod === 'totp' ? 'Enter the dynamic 6-digit code from Google Authenticator.' : (twoFactorMethod === 'email' ? 'Enter the 6-digit verification code sent to your email.' : 'Enter the 6-digit code sent to your registered phone number.'))}
            {view === 'register_otp' && (registerOtpMethod === 'phone' ? 'Enter the 6-digit verification code sent to your phone.' : 'Enter the 6-digit verification code sent to your registered email.')}
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
              <label style={labelStyle}>
                {(view === 'login' || view === 'forgot') ? 'Email, Username or Client ID' : 'Email ID'}
              </label>
              <input 
                type={(view === 'login' || view === 'forgot') ? 'text' : 'email'} 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="premium-input" 
                placeholder={(view === 'login' || view === 'forgot') ? 'Email, username, or SE00000C' : 'john@example.com'} 
              />
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  {registerOtpMethod === 'phone' ? '6-Digit SMS Verification Code' : '6-Digit Email Verification Code'}
                </label>
                <button
                  type="button"
                  disabled={sendingRegOtp}
                  onClick={async () => {
                    setSendingRegOtp(true);
                    useStore.setState({ authError: null });
                    const cleanPhone = String(phone || '').replace(/\D/g, '');
                    const res = await sendRegistrationOtp(username.trim(), email.trim().toLowerCase(), cleanPhone);
                    setSendingRegOtp(false);
                    if (res && res.success) {
                      setRegisterOtpMethod('email');
                      setMessage(`A fresh 6-digit code has been dispatched to ${email.trim().toLowerCase()}.`);
                    } else {
                      useStore.setState({ authError: res?.error || 'Failed to dispatch verification code.' });
                    }
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--color-blue-light)', fontSize: '11.5px', cursor: 'pointer', fontWeight: '600' }}
                >
                  {sendingRegOtp ? 'Sending...' : 'Resend Code via Email'}
                </button>
              </div>
              <input type="text" required maxLength="6" inputMode="numeric" pattern="[0-9]*" value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} className="premium-input" placeholder="000000" style={{ letterSpacing: '8px', fontSize: '24px', textAlign: 'center', fontWeight: 'bold' }} />
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                {registerOtpMethod === 'phone' ? (
                  <>Enter the 6-digit SMS code sent to <strong>+91 {phone}</strong>. If SMS is delayed, click &quot;Resend Code via Email&quot; above.</>
                ) : (
                  <>Enter the 6-digit code sent to <strong>{email}</strong>. Check your inbox and spam folder.</>
                )}
              </div>
            </div>
          )}

          {view === 'login_otp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '13px', color: '#60a5fa' }}>
                🔒 Authenticating account: <strong>{email}</strong>
              </div>

              {/* Dynamic 2FA Input (Google Authenticator or Email OTP) */}
              {hasTotp ? (
                <div>
                  <label style={labelStyle}>6-Digit Google Authenticator Code</label>
                  <input type="text" required maxLength="6" inputMode="numeric" pattern="[0-9]*" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} className="premium-input" placeholder="000000" style={{ letterSpacing: '8px', fontSize: '24px', textAlign: 'center', fontWeight: 'bold' }} />
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    Open your Google Authenticator or Authy app and enter the 6-digit dynamic code.
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>6-Digit Email Verification Code</label>
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
          {view === 'register' && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '14px',
              margin: '8px 0 14px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#10b981' }}>
                Consent Declarations (DPDP Act, 2023)
              </div>

              {/* Purpose 1: Terms & Privacy (Mandatory) */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '12px', color: '#d1d5db', lineHeight: '1.4' }}>
                <input
                  type="checkbox"
                  checked={consentTerms}
                  onChange={(e) => setConsentTerms(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: '#10b981', cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <span>
                  I agree to the <a href="/terms" target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>Terms of Service</a> and confirm I have read the <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>Privacy Notice</a>. <strong style={{ color: '#ef4444' }}>*</strong>
                </span>
              </label>

              {/* Purpose 2: Core Data Processing (Mandatory) */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '12px', color: '#d1d5db', lineHeight: '1.4' }}>
                <input
                  type="checkbox"
                  checked={consentDataProcessing}
                  onChange={(e) => setConsentDataProcessing(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: '#10b981', cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <span>
                  I consent to the collection and processing of my phone, email, device telemetry, and order logs for account authentication, trade execution, and regulatory compliance. <strong style={{ color: '#ef4444' }}>*</strong>
                </span>
              </label>

              {/* Purpose 3: Marketing & Research (Optional) */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '12px', color: '#9ca3af', lineHeight: '1.4' }}>
                <input
                  type="checkbox"
                  checked={consentMarketing}
                  onChange={(e) => setConsentMarketing(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: '#10b981', cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <span>
                  I agree to receive market analysis, research alerts, and platform announcements via SMS/Email (Optional).
                </span>
              </label>
            </div>
          )}

          <div id="recaptcha-container"></div>
          <button type="submit" disabled={loading} className="premium-btn" style={{ marginTop: '12px' }}>
            {loading ? 'PROCESSING...' : 
              (view === 'login' ? 'LOG IN' : 
               view === 'login_otp' ? (hasTotp ? 'VERIFY AUTHENTICATOR' : 'VERIFY CODE') :
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
          
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', color: '#6b7280' }}>
            By continuing, you agree to SkandX's{' '}
            <a href="/terms" style={{ color: '#10b981', textDecoration: 'none' }}>Terms</a>
            {' '}&bull;{' '}
            <a href="/privacy-policy" style={{ color: '#10b981', textDecoration: 'none' }}>Privacy Policy</a>
            {' '}&bull;{' '}
            <a href="/risk-policy" style={{ color: '#10b981', textDecoration: 'none' }}>Risk Disclosure</a>
          </div>
        </div>
      </div>
    </div>
  );
}



