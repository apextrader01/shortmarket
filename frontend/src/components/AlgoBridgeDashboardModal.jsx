// frontend/src/components/AlgoBridgeDashboardModal.jsx
// 🌟 Wraps the unified SkandxAlgoView (Per-User Authenticated + Razorpay Gateway) in a Modal Overlay

import React from 'react';
import SkandxAlgoView from './SkandxAlgoView';

export default function AlgoBridgeDashboardModal({ isOpen, onClose, initialTab = 'Dashboard' }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99990,
      background: '#070a12',
      overflowY: 'auto',
      overflowX: 'hidden'
    }}>
      <SkandxAlgoView
        initialTab={initialTab}
        onBack={onClose}
      />
    </div>
  );
}
