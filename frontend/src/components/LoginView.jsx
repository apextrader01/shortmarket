import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase';

export default function LoginView() {
  const { login, preLogin, register, forgotPassword, verifyResetOtp, resetPassword, authError } = useStore(useShallow(state => ({ login: state.login, preLogin: state.preLogin, register: state.register, forgotPassword: state.forgotPassword, verifyResetOtp: state.verifyResetOtp, resetPassword: state.resetPassword, authError: state.authError })));
  
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    useStore.setState({ authError: null });
    setMessage('');

    if (view === 'login') {
      const res = await preLogin(email, password);
      if (res && res.success) {
        try {
          if (window.recaptchaVerifier) {
            try { window.recaptchaVerifier.clear(); } catch (_) {}
            window.recaptchaVerifier = null;
          }
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible'
          });
          const rawPhone = String(res.phone || '').trim();
          const cleanPhone = rawPhone.replace(/\D/g, '');
          const formattedPhone = rawPhone.startsWith('+') ? rawPhone : '+91' + cleanPhone;
          const confirmation = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
          setConfirmationResult(confirmation);
          setView('login_otp');
          setMessage(`2FA security code sent to registered number ending in ${cleanPhone.slice(-4)}.`);
        } catch (error) {
          useStore.setState({ authError: error.message || 'Failed to send 2FA security code.' });
        }
      }
    } 
    else if (view === 'login_otp') {
      try {
        if (!confirmationResult) {
          throw new Error('No pending OTP verification session. Please log in again.');
        }
        await confirmationResult.confirm(phoneOtp);
        await login(email, password);
      } catch (error) {
        useStore.setState({ authError: 'Invalid 2FA code. Please check and try again.' });
      }
    }
    else if (view === 'register') {
      try {
        // Clear stale recaptcha verifier to avoid expired token errors
        if (window.recaptchaVerifier) {
          try { window.recaptchaVerifier.clear(); } catch (_) {}
          window.recaptchaVerifier = null;
        }
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible'
        });
        const cleanPhone = phone.replace(/\D/g, '');
        const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length > 10 
          ? '+' + cleanPhone 
          : '+91' + cleanPhone;
        const confirmation = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
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
        setMessage('OTP sent to your email! (Valid for 15 minutes)');
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
        useStore.setState({ authError: 'Session expired. Please enter your email again.' });
        setLoading(false);
        return;
      }
      const res = await resetPassword(email, otp, password);
      if (res && res.success) {
        setMessage('Password reset successfully! Please log in.');
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
            {view === 'login_otp' && 'Enter the 6-digit code sent to your registered phone number.'}
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

          {(view === 'register_otp' || view === 'login_otp') && (
            <div>
              <label style={labelStyle}>6-Digit Phone OTP</label>
              <input type="text" required maxLength="6" inputMode="numeric" pattern="[0-9]*" value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} className="premium-input" placeholder="000000" style={{ letterSpacing: '8px', fontSize: '24px', textAlign: 'center', fontWeight: 'bold' }} />
            </div>
          )}

          {view === 'login_otp' && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '13px', color: '#60a5fa' }}>
              🔒 Authenticating account: <strong>{email}</strong>
            </div>
          )}

          {view === 'reset' && email && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '13px', color: '#60a5fa' }}>
              🔑 Resetting password for: <strong>{email}</strong>
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
            </div>
          )}

          <div id="recaptcha-container"></div>
          <button type="submit" disabled={loading} className="premium-btn" style={{ marginTop: '12px' }}>
            {loading ? 'PROCESSING...' : 
              (view === 'login' ? 'LOG IN' : 
               view === 'login_otp' ? 'VERIFY OTP' :
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



