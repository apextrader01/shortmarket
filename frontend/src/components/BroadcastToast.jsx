import React, { useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { X, TrendingUp, TrendingDown, Newspaper, Bell, ArrowRight, Zap } from 'lucide-react';

export default function BroadcastToast() {
  const { activeBroadcastToast, dismissBroadcastToast, openOrderModal, setSelectedSymbol } = useStore(
    useShallow(state => ({
      activeBroadcastToast: state.activeBroadcastToast,
      dismissBroadcastToast: state.dismissBroadcastToast,
      openOrderModal: state.openOrderModal,
      setSelectedSymbol: state.setSelectedSymbol
    }))
  );

  useEffect(() => {
    if (!activeBroadcastToast) return;
    const timer = setTimeout(() => {
      dismissBroadcastToast();
    }, 12000);
    return () => clearTimeout(timer);
  }, [activeBroadcastToast, dismissBroadcastToast]);

  if (!activeBroadcastToast) return null;

  const { type, side, symbol, entry_price, target_price, stop_loss, title, message, impact } = activeBroadcastToast;
  const isSignal = type === 'SIGNAL' || side === 'BUY' || side === 'SELL';
  const isBuy = side === 'BUY';
  const isSell = side === 'SELL';
  const isNews = type === 'NEWS';

  const handleTradeAction = () => {
    if (symbol) {
      setSelectedSymbol?.(symbol);
      openOrderModal?.(symbol, isSell ? 'SELL' : 'BUY');
    }
    dismissBroadcastToast();
  };

  return (
    <div style={{
      position: 'fixed',
      top: '72px',
      right: '20px',
      zIndex: 999999,
      maxWidth: '380px',
      width: 'calc(100vw - 40px)',
      background: isBuy 
        ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)'
        : (isSell 
          ? 'linear-gradient(135deg, rgba(127, 29, 29, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)'
          : (isNews
            ? 'linear-gradient(135deg, rgba(30, 58, 138, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)'
            : 'linear-gradient(135deg, rgba(88, 28, 135, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)')),
      border: isBuy 
        ? '1px solid #10B981' 
        : (isSell 
          ? '1px solid #EF4444' 
          : (isNews ? '1px solid #3B82F6' : '1px solid #8B5CF6')),
      borderRadius: '14px',
      padding: '16px 18px',
      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0,0,0,0.4)',
      backdropFilter: 'blur(16px)',
      color: '#fff',
      animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isBuy && (
            <div style={{ background: '#10B981', color: '#000', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={13} /> 🟢 BUY CALL
            </div>
          )}
          {isSell && (
            <div style={{ background: '#EF4444', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingDown size={13} /> 🔴 SELL CALL
            </div>
          )}
          {isNews && (
            <div style={{ background: '#3B82F6', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Newspaper size={13} /> 📰 MARKET NEWS
            </div>
          )}
          {!isSignal && !isNews && (
            <div style={{ background: '#8B5CF6', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Bell size={13} /> 📢 ANNOUNCEMENT
            </div>
          )}
          <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>Just now</span>
        </div>
        <button
          onClick={dismissBroadcastToast}
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      {/* Main Content */}
      {isSignal ? (
        <div>
          <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.3px', color: '#fff' }}>
            {symbol || title}
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr', 
            gap: '8px', 
            background: 'rgba(0,0,0,0.3)', 
            padding: '8px 10px', 
            borderRadius: '8px',
            marginBottom: '10px',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>ENTRY</div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>₹{entry_price || 'CMP'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>TARGET</div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#34D399' }}>₹{target_price || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>STOP LOSS</div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#F87171' }}>₹{stop_loss || '—'}</div>
            </div>
          </div>

          {message && (
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', margin: '0 0 10px 0', lineHeight: '1.4' }}>
              {message}
            </p>
          )}

          {symbol && (
            <button
              onClick={handleTradeAction}
              style={{
                width: '100%',
                padding: '9px 12px',
                background: isBuy ? '#10B981' : '#EF4444',
                color: isBuy ? '#000' : '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: isBuy ? '0 4px 12px rgba(16, 185, 129, 0.4)' : '0 4px 12px rgba(239, 68, 68, 0.4)'
              }}
            >
              <Zap size={14} /> Trade {symbol} ({side})
            </button>
          )}
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '15px', fontWeight: '800', marginBottom: '6px', color: '#fff' }}>
            {title}
          </div>
          {impact && (
            <div style={{ display: 'inline-block', marginBottom: '8px', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: impact === 'BULLISH' ? 'rgba(16, 185, 129, 0.2)' : (impact === 'BEARISH' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.2)'), color: impact === 'BULLISH' ? '#34D399' : (impact === 'BEARISH' ? '#F87171' : '#CBD5E1') }}>
              {impact === 'BULLISH' ? '📈 Bullish Outlook' : (impact === 'BEARISH' ? '📉 Bearish Outlook' : '⚖️ Neutral Impact')}
            </div>
          )}
          <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: '1.45' }}>
            {message}
          </p>
        </div>
      )}
    </div>
  );
}
