import React from 'react';
import { Lock, LogIn } from 'lucide-react';
import { useStore } from '../store';

export default function SessionExpiredModal() {
  const isSessionExpired = useStore(state => state.isSessionExpired);
  const setSessionExpired = useStore(state => state.setSessionExpired);
  const logout = useStore(state => state.logout);

  if (!isSessionExpired) return null;

  const handleLoginAgain = () => {
    setSessionExpired(false);
    logout();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px'
      }}
    >
      <div
        style={{
          background: 'var(--bg-card, #1e222d)',
          border: '1px solid var(--border-color, #2a2e39)',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: '#ef4444'
          }}
        >
          <Lock size={26} />
        </div>

        <h3
          style={{
            fontSize: '18px',
            fontWeight: '700',
            color: 'var(--text-primary, #ffffff)',
            marginBottom: '8px'
          }}
        >
          Session Expired
        </h3>

        <p
          style={{
            fontSize: '13.5px',
            color: 'var(--text-secondary, #94a3b8)',
            lineHeight: '1.5',
            marginBottom: '20px'
          }}
        >
          Your trading session has timed out due to security inactivity. Please log in again to continue managing your orders and portfolio.
        </p>

        <button
          onClick={handleLoginAgain}
          style={{
            width: '100%',
            padding: '11px 16px',
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background 0.2s'
          }}
        >
          <LogIn size={16} /> Log In Again
        </button>
      </div>
    </div>
  );
}
