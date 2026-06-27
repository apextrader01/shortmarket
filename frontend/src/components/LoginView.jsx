import React, { useState } from 'react';
import { useStore } from '../store';

export default function LoginView() {
  const { login, register, authError } = useStore();
  const [isLogin, setIsLogin] = useState(true);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      await login(email, password);
    } else {
      await register(username, email, password);
    }
    setLoading(false);
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '40px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div className="logo-text" style={{ fontSize: '28px', marginBottom: '8px' }}>
            SHORT <span>MARKET</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {isLogin ? 'Log in to your terminal' : 'Create your trading account'}
          </div>
        </div>

        {authError && (
          <div style={{ background: 'rgba(225, 42, 31, 0.1)', color: 'var(--color-red-light)', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '24px', textAlign: 'center', border: '1px solid rgba(225, 42, 31, 0.3)' }}>
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!isLogin && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Username</label>
              <input 
                type="text" required value={username} onChange={e => setUsername(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px', color: '#fff', fontSize: '14px', outline: 'none' }} 
              />
            </div>
          )}
          
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email Address</label>
            <input 
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px', color: '#fff', fontSize: '14px', outline: 'none' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Password</label>
            <input 
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px', color: '#fff', fontSize: '14px', outline: 'none' }} 
            />
          </div>

          <button 
            type="submit" disabled={loading}
            style={{ 
              background: 'var(--color-blue)', color: 'white', border: 'none', padding: '14px', 
              borderRadius: '6px', fontSize: '14px', fontWeight: '700', letterSpacing: '0.5px',
              cursor: loading ? 'not-allowed' : 'pointer', marginTop: '8px', opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'PROCESSING...' : (isLogin ? 'LOG IN' : 'SIGN UP')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span 
            onClick={() => { setIsLogin(!isLogin); useStore.setState({ authError: null }); }} 
            style={{ color: 'var(--color-blue)', cursor: 'pointer', fontWeight: '600' }}
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </span>
        </div>

      </div>
    </div>
  );
}
