import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showBanner, setShowBanner] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      setShowBanner(true);
      const timer = setTimeout(() => {
        setShowBanner(false);
        setJustReconnected(false);
      }, 2800);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check: if already offline on load
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      role="alert"
      style={{
        width: '100%',
        padding: '8px 16px',
        fontSize: '12.5px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: '#ffffff',
        background: justReconnected
          ? 'linear-gradient(90deg, #059669, #10b981)'
          : 'linear-gradient(90deg, #b91c1c, #dc2626)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        zIndex: 9999,
        transition: 'all 0.3s ease-in-out',
        position: 'sticky',
        top: 0
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {justReconnected ? <Wifi size={16} /> : <WifiOff size={16} />}
        <span>
          {justReconnected
            ? 'Connection restored. Live market data is now active.'
            : 'No internet connection. Live trading feed paused — reconnecting...'}
        </span>
      </div>

      {!justReconnected && (
        <button
          onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.onLine) {
              setIsOnline(true);
              setJustReconnected(true);
              setTimeout(() => setShowBanner(false), 2500);
            } else {
              window.location.reload();
            }
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            color: '#fff',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <RefreshCw size={11} /> Retry
        </button>
      )}
    </div>
  );
}
