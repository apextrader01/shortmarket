import React from 'react';
import { Compass, Home, TrendingUp, Shield, ArrowLeft } from 'lucide-react';

export default function NotFoundView({ onNavigateHome, initialRequestedPath }) {
  const handleHome = () => {
    if (typeof onNavigateHome === 'function') {
      onNavigateHome();
    } else {
      window.location.href = '/';
    }
  };

  const currentPath = initialRequestedPath || (typeof window !== 'undefined' ? window.location.pathname : '');

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#0a0b0d',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px',
      position: 'relative',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      boxSizing: 'border-box'
    }}>
      {/* Background Glow */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, rgba(16, 185, 129, 0.04) 40%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Main 404 Container */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: '520px',
        width: '100%',
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        padding: '40px 32px',
        textAlign: 'center',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(16px)'
      }}>
        {/* Animated Brand Icon */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '18px',
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px auto',
          color: '#38bdf8'
        }}>
          <Compass size={36} strokeWidth={1.75} />
        </div>

        {/* 404 Number Badge */}
        <div style={{
          fontSize: '64px',
          fontWeight: '900',
          lineHeight: '1',
          letterSpacing: '-2px',
          marginBottom: '12px',
          fontFamily: "'Outfit', sans-serif",
          background: 'linear-gradient(135deg, #38bdf8 0%, #34d399 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          404
        </div>

        <h1 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#ffffff',
          marginBottom: '12px',
          letterSpacing: '-0.5px'
        }}>
          Trading Floor Not Found
        </h1>

        <p style={{
          fontSize: '14.5px',
          lineHeight: '1.6',
          color: '#94a3b8',
          marginBottom: '24px'
        }}>
          The page or symbol route {currentPath ? <code style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>{currentPath}</code> : 'you requested'} does not exist or may have been relocated to another market segment.
        </p>

        {/* Primary CTA Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={handleHome}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              padding: '13px 20px',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '700',
              color: '#ffffff',
              background: 'linear-gradient(135deg, #0284c7 0%, #059669 100%)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
            }}
          >
            <TrendingUp size={18} />
            Go to Trading Terminal
          </button>

          <button
            onClick={() => { window.location.href = '/terms'; }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '11px 18px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: '600',
              color: '#94a3b8',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Shield size={16} />
            Platform Legal & Compliance
          </button>
        </div>

        {/* Brand Signoff */}
        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          paddingTop: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '12px',
          color: '#64748b'
        }}>
          <span>SkandX Algorithmic Trading Platform &bull; SEBI / NSE / BSE Compliant Terminal</span>
        </div>
      </div>
    </div>
  );
}
