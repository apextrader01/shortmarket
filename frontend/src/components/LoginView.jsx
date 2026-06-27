import React, { useState } from 'react';
import { useStore } from '../store';

export default function LoginView() {
  const { login, register, forgotPassword, resetPassword, authError } = useStore();
  
  // view: 'login', 'register', 'forgot', 'otp', 'reset'
  const [view, setView] = useState('login');
  
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [otp,      setOtp]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [message,  setMessage]  = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    useStore.setState({ authError: null });
    setMessage('');

    if (view === 'login') {
      await login(email, password);
    } 
    else if (view === 'register') {
      await register(username, email, password);
    }
    else if (view === 'forgot') {
      const res = await forgotPassword(email);
      if (res.success) {
        setMessage('OTP sent to your email! (Valid for 15 minutes)');
        setView('otp');
      } else {
        useStore.setState({ authError: res.error });
      }
    }
    else if (view === 'otp') {
      // Just move to reset password screen
      if (otp.length === 6) {
        setView('reset');
      } else {
        useStore.setState({ authError: 'OTP must be 6 digits' });
      }
    }
    else if (view === 'reset') {
      const res = await resetPassword(email, otp, password);
      if (res.success) {
        setMessage('Password reset successfully! Please log in.');
        setView('login');
        setPassword('');
        setOtp('');
      } else {
        useStore.setState({ authError: res.error });
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
    color:        '#fff',
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
    <div style={{
      width:          '100%',
      minHeight:      '100vh',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'var(--bg-primary)',
    }}>
      <div style={{
        width:        '100%',
        maxWidth:     '400px',
        padding:      '40px',
        background:   'var(--bg-secondary)',
        borderRadius: '12px',
        border:       '1px solid var(--border-color)',
        boxShadow:    '0 25px 50px -12px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div className="logo-text" style={{ fontSize: '28px', marginBottom: '8px' }}>
            SHORT <span>MARKET</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {view === 'login' && 'Log in to your terminal'}
            {view === 'register' && 'Create your trading account'}
            {view === 'forgot' && 'Reset your password'}
            {view === 'otp' && 'Verify OTP'}
            {view === 'reset' && 'Create new password'}
          </div>
        </div>

        {/* Error Banner */}
        {authError && (
          <div style={{
            background:   'rgba(225, 42, 31, 0.1)',
            color:        'var(--color-red-light)',
            padding:      '12px',
            borderRadius: '6px',
            fontSize:     '13px',
            marginBottom: '24px',
            textAlign:    'center',
            border:       '1px solid rgba(225, 42, 31, 0.3)',
          }}>
            {authError}
          </div>
        )}

        {/* Success Banner */}
        {message && (
          <div style={{
            background:   'rgba(34, 197, 94, 0.1)',
            color:        'var(--color-green-light)',
            padding:      '12px',
            borderRadius: '6px',
            fontSize:     '13px',
            marginBottom: '24px',
            textAlign:    'center',
            border:       '1px solid rgba(34, 197, 94, 0.3)',
          }}>
            {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {view === 'register' && (
            <div>
              <label style={labelStyle}>Username</label>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
            </div>
          )}

          {(view === 'login' || view === 'register' || view === 'forgot') && (
            <div>
              <label style={labelStyle}>Email Address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </div>
          )}

          {view === 'otp' && (
            <div>
              <label style={labelStyle}>6-Digit OTP</label>
              <input type="text" required maxLength="6" value={otp} onChange={(e) => setOtp(e.target.value)} style={inputStyle} placeholder="Enter the code sent to your email" />
            </div>
          )}

          {(view === 'login' || view === 'register' || view === 'reset') && (
            <div>
              <label style={labelStyle}>{view === 'reset' ? 'New Password' : 'Password'}</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            </div>
          )}

          {view === 'login' && (
            <div style={{ textAlign: 'right', marginTop: '-10px' }}>
               <span onClick={() => switchMode('forgot')} style={{ color: 'var(--color-blue)', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>Forgot Password?</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background:    'var(--color-blue)',
              color:         'white',
              border:        'none',
              padding:       '14px',
              borderRadius:  '6px',
              fontSize:      '14px',
              fontWeight:    '700',
              letterSpacing: '0.5px',
              cursor:        loading ? 'not-allowed' : 'pointer',
              marginTop:     '8px',
              opacity:       loading ? 0.7 : 1,
              transition:    'opacity 0.2s ease',
            }}
          >
            {loading ? 'PROCESSING...' : 
              (view === 'login' ? 'LOG IN' : 
               view === 'register' ? 'SIGN UP' : 
               view === 'forgot' ? 'SEND RESET LINK' : 
               view === 'otp' ? 'VERIFY OTP' : 'RESET PASSWORD')}
          </button>
        </form>

        {/* Toggle */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {(view === 'login' || view === 'forgot' || view === 'otp' || view === 'reset') ? "Don't have an account? " : 'Already have an account? '}
          <span
            onClick={() => switchMode(view === 'register' ? 'login' : 'register')}
            style={{ color: 'var(--color-blue)', cursor: 'pointer', fontWeight: '600' }}
          >
            {(view === 'login' || view === 'forgot' || view === 'otp' || view === 'reset') ? 'Sign up' : 'Log in'}
          </span>
          {(view === 'forgot' || view === 'otp' || view === 'reset') && (
            <div style={{ marginTop: '12px' }}>
              <span onClick={() => switchMode('login')} style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}>Back to login</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
