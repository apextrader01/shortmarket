import React from 'react';
import { useStore } from '../store';
import { Briefcase } from 'lucide-react';

export default function PositionsView() {
  const { positions } = useStore();

  if (positions.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
        <div style={{ 
          width: '120px', height: '100px', background: 'var(--bg-panel)', 
          borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', marginBottom: '24px', position: 'relative'
        }}>
          <Briefcase size={40} color="var(--color-green-light)" />
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '24px' }}>✨</div>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>You do not have any positions</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>List of all your positions for today will appear here.</p>
        <button style={{
          background: 'var(--color-blue)', color: 'white', padding: '10px 24px', 
          borderRadius: '4px', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px',
          border: 'none', cursor: 'pointer'
        }}>
          VIEW TRADING IDEAS
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', width: '100%', background: 'var(--bg-dark)', overflowY: 'auto' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Positions</h2>
      {/* Table will go here later */}
    </div>
  );
}
