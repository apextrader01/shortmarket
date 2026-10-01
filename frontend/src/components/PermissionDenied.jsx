import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function PermissionDenied({ onBack, title = "403: Access Restricted", message = "You do not have administrative privileges to access this area." }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '32px 16px',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          color: '#ef4444'
        }}
      >
        <ShieldAlert size={32} />
      </div>

      <h2
        style={{
          fontSize: '20px',
          fontWeight: '700',
          color: 'var(--text-primary, #ffffff)',
          marginBottom: '8px'
        }}
      >
        {title}
      </h2>

      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-secondary, #94a3b8)',
          maxWidth: '420px',
          lineHeight: '1.5',
          marginBottom: '24px'
        }}
      >
        {message}
      </p>

      {onBack && (
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: 'var(--color-blue, #2563eb)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13.5px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} /> Return to Trading Dashboard
        </button>
      )}
    </div>
  );
}
