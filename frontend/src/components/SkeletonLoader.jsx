import React from 'react';

export default function SkeletonLoader({ rows = 4, type = 'table' }) {
  if (type === 'cards') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', padding: '16px 0' }}>
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            style={{
              height: '110px',
              borderRadius: '10px',
              background: 'var(--bg-secondary, #2a2e39)',
              opacity: 0.6,
              animation: 'pulse 1.5s ease-in-out infinite'
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', padding: '12px 0' }}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          style={{
            height: '48px',
            marginBottom: '8px',
            borderRadius: '6px',
            background: 'var(--bg-secondary, #2a2e39)',
            opacity: 0.5,
            animation: 'pulse 1.5s ease-in-out infinite'
          }}
        />
      ))}
    </div>
  );
}
