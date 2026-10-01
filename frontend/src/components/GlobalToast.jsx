import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useStore } from '../store';

export default function GlobalToast() {
  const toast = useStore(state => state.toast);
  const hideToast = useStore(state => state.hideToast);

  if (!toast) return null;

  const type = toast.type || 'info';
  const title = toast.title;
  const message = typeof toast === 'string' ? toast : toast.message;

  const colors = {
    success: {
      bg: 'rgba(16, 185, 129, 0.15)',
      border: 'rgba(16, 185, 129, 0.4)',
      text: '#10b981',
      icon: CheckCircle
    },
    error: {
      bg: 'rgba(239, 68, 68, 0.15)',
      border: 'rgba(239, 68, 68, 0.4)',
      text: '#ef4444',
      icon: AlertCircle
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.4)',
      text: '#f59e0b',
      icon: AlertTriangle
    },
    info: {
      bg: 'rgba(59, 130, 246, 0.15)',
      border: 'rgba(59, 130, 246, 0.4)',
      text: '#3b82f6',
      icon: Info
    }
  };

  const current = colors[type] || colors.info;
  const IconComponent = current.icon;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        maxWidth: '380px',
        width: 'calc(100vw - 40px)',
        zIndex: 999999,
        background: 'var(--bg-card, #1e222d)',
        border: `1px solid ${current.border}`,
        borderRadius: '10px',
        padding: '12px 16px',
        boxShadow: '0 12px 28px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        animation: 'slideInRight 0.25s ease-out'
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: current.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: current.text,
          marginTop: '2px'
        }}
      >
        <IconComponent size={17} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <h4
            style={{
              margin: '0 0 3px 0',
              fontSize: '13.5px',
              fontWeight: '700',
              color: 'var(--text-primary, #ffffff)'
            }}
          >
            {title}
          </h4>
        )}
        <p
          style={{
            margin: 0,
            fontSize: '12.5px',
            color: 'var(--text-secondary, #94a3b8)',
            lineHeight: '1.4',
            wordBreak: 'break-word'
          }}
        >
          {message}
        </p>
      </div>

      <button
        onClick={hideToast}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary, #94a3b8)',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.7,
          marginTop: '2px'
        }}
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>
    </div>
  );
}
