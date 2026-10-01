import React from 'react';
import { Inbox, ArrowRight } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Inbox,
  title = "No data available",
  subtitle = "Items will appear here once activity starts.",
  actionText,
  onAction,
  height = "320px"
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: height,
        padding: '32px 16px',
        textAlign: 'center',
        width: '100%'
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '16px',
          background: 'var(--bg-secondary, #2a2e39)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          color: 'var(--text-secondary, #94a3b8)',
          boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
        }}
      >
        <Icon size={34} strokeWidth={1.5} />
      </div>

      <h3
        style={{
          fontSize: '16px',
          fontWeight: '700',
          color: 'var(--text-primary, #ffffff)',
          marginBottom: '6px'
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: '13px',
          color: 'var(--text-secondary, #94a3b8)',
          maxWidth: '360px',
          lineHeight: '1.5',
          margin: actionText ? '0 0 16px 0' : 0
        }}
      >
        {subtitle}
      </p>

      {actionText && onAction && (
        <button
          onClick={onAction}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            background: 'rgba(37, 99, 235, 0.15)',
            color: 'var(--color-blue, #3b82f6)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '6px',
            fontSize: '12.5px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <span>{actionText}</span>
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
