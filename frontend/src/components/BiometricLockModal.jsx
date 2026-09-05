import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Lock, Fingerprint, Delete, Shield, LogOut, KeyRound } from 'lucide-react';
import { verifyUserPin, isBiometricsEnabled, verifyBiometrics, setAppLocked } from '../utils/biometricAuth';

export default function BiometricLockModal({ onUnlock }) {
  const { user, logout } = useStore(useShallow(state => ({ user: state.user, logout: state.logout })));
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [hasBio, setHasBio] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const userId = user?.id || 'default';

  useEffect(() => {
    setHasBio(isBiometricsEnabled(userId));
    // Auto-prompt biometrics on load if enabled
    if (isBiometricsEnabled(userId)) {
      handleBiometricUnlock();
    }
  }, [userId]);

  const handleDigitClick = (digit) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg('');
      if (nextPin.length === 4) {
        validatePin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
  };

  const triggerShake = (msg) => {
    setErrorMsg(msg);
    setIsShaking(true);
    setPin('');
    setTimeout(() => setIsShaking(false), 500);
  };

  const validatePin = async (enteredPin) => {
    setIsVerifying(true);
    try {
      const isValid = await verifyUserPin(enteredPin, userId);
      if (isValid) {
        setAppLocked(false);
        onUnlock();
      } else {
        triggerShake('Incorrect PIN. Please try again.');
      }
    } catch (e) {
      triggerShake('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setIsVerifying(true);
    try {
      const success = await verifyBiometrics(userId);
      if (success) {
        setAppLocked(false);
        onUnlock();
      }
    } catch (err) {
      console.warn('Biometric unlock cancelled/failed:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigitClick(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 10, 20, 0.95)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      color: '#fff'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '32px 24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        animation: isShaking ? 'shake 0.4s ease-in-out' : 'none'
      }}>
        {/* App Branding & Lock Badge */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.4))',
          border: '1px solid rgba(59, 130, 246, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#60a5fa',
          marginBottom: '16px',
          boxShadow: '0 0 20px rgba(59, 130, 246, 0.25)'
        }}>
          <Lock size={26} />
        </div>

        <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>
          Short Edge Secure
        </h3>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Welcome back, <strong style={{ color: '#fff' }}>{user?.username || 'Trader'}</strong> ({user?.client_id || 'SE000001'})
        </div>

        {/* 4 Digit PIN Dots */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
          {[0, 1, 2, 3].map(idx => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: isFilled ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.2)',
                  background: isFilled ? '#3b82f6' : 'transparent',
                  transform: isFilled ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.15s ease',
                  boxShadow: isFilled ? '0 0 10px rgba(59,130,246,0.6)' : 'none'
                }}
              />
            );
          })}
        </div>

        {/* Error Message */}
        {errorMsg ? (
          <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600', marginBottom: '16px', minHeight: '18px' }}>
            {errorMsg}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', minHeight: '18px' }}>
            Enter your 4-digit security PIN
          </div>
        )}

        {/* Keypad Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          width: '100%',
          maxWidth: '280px',
          marginBottom: '20px'
        }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigitClick(num)}
              style={{
                height: '56px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#fff',
                fontSize: '20px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.1s ease',
                userSelect: 'none'
              }}
              onMouseDown={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'}
              onMouseUp={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              onTouchStart={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'}
              onTouchEnd={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            >
              {num}
            </button>
          ))}

          {/* Biometrics / Clear Button */}
          {hasBio ? (
            <button
              type="button"
              onClick={handleBiometricUnlock}
              title="Unlock with Biometrics (Face ID / Fingerprint)"
              style={{
                height: '56px',
                borderRadius: '14px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                color: '#60a5fa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Fingerprint size={22} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClear}
              style={{
                height: '56px',
                borderRadius: '14px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              CLEAR
            </button>
          )}

          {/* 0 Button */}
          <button
            type="button"
            onClick={() => handleDigitClick('0')}
            style={{
              height: '56px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#fff',
              fontSize: '20px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none'
            }}
            onMouseDown={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'}
            onMouseUp={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleBackspace}
            style={{
              height: '56px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Log out and return to password login screen?')) {
                setAppLocked(false);
                logout();
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <LogOut size={13} /> Sign Out
          </button>

          <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Shield size={12} color="#10b981" /> 256-Bit Encrypted
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
