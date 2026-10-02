import React, { useState } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { X, TrendingUp, TrendingDown, Newspaper, Bell, CheckCheck, Zap, Trash2, Clock, ShieldAlert } from 'lucide-react';
import { getInstantLotsize } from '../utils/lotsizeHelper';

export default function NotificationDrawer({ isOpen, onClose, onOpenBroadcastModal }) {
  const { user, broadcastNotifications, markAllNotificationsRead, deleteBroadcastNotification, openOrderModal, setSelectedSymbol } = useStore(
    useShallow(state => ({
      user: state.user,
      broadcastNotifications: state.broadcastNotifications || [],
      markAllNotificationsRead: state.markAllNotificationsRead,
      deleteBroadcastNotification: state.deleteBroadcastNotification,
      openOrderModal: state.openOrderModal,
      setSelectedSymbol: state.setSelectedSymbol
    }))
  );

  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'SIGNAL', 'NEWS', 'ANNOUNCEMENT'

  if (!isOpen) return null;

  const filtered = broadcastNotifications.filter(item => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'SIGNAL') return item.type === 'SIGNAL' || item.side === 'BUY' || item.side === 'SELL';
    if (activeFilter === 'NEWS') return item.type === 'NEWS';
    if (activeFilter === 'ANNOUNCEMENT') return item.type === 'ANNOUNCEMENT' && !item.side;
    return true;
  });

  const handleTrade = (item) => {
    if (item.symbol) {
      setSelectedSymbol?.(item.symbol);
      const effectiveProd = (item.product_type === 'DEL' || item.product_type === 'DELIVERY') ? 'DEL' : 'INT';
      const effectiveLotsize = getInstantLotsize(item.symbol);
      const initPrice = (item.entry_price && !isNaN(Number(item.entry_price)) && Number(item.entry_price) > 0) ? Number(item.entry_price) : null;
      openOrderModal?.(item.symbol, item.side === 'SELL' ? 'SELL' : 'BUY', effectiveLotsize, effectiveProd, false, 0, initPrice);
      onClose();
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (_) {
      return '';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'flex-end',
      animation: 'fadeIn 0.2s ease-out'
    }} onClick={onClose}>
      <div 
        style={{
          width: '100%',
          maxWidth: '460px',
          height: '100%',
          background: 'var(--bg-dark, #0f172a)',
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
          animation: 'slideInRight 0.25s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-panel)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '8px', borderRadius: '10px' }}>
              <Bell size={20} color="var(--color-blue)" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                Notification Center
              </h3>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Real-time trade signals, news & market updates
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={markAllNotificationsRead}
              title="Mark all as read"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                padding: '5px 8px',
                cursor: 'pointer',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              className="hoverable"
            >
              <CheckCheck size={14} /> Clear Unread
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center'
              }}
              className="hoverable"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter Pills & Admin Action */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          overflowX: 'auto'
        }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'SIGNAL', label: '🎯 Signals' },
              { id: 'NEWS', label: '📰 News' },
              { id: 'ANNOUNCEMENT', label: '📢 Updates' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '11.5px',
                  fontWeight: activeFilter === tab.id ? '700' : '500',
                  background: activeFilter === tab.id ? 'var(--color-blue)' : 'var(--bg-hover)',
                  color: activeFilter === tab.id ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: '0.15s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {user?.is_admin && onOpenBroadcastModal && (
            <button
              onClick={() => {
                onClose();
                onOpenBroadcastModal();
              }}
              style={{
                padding: '5px 10px',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              className="hoverable"
            >
              + Broadcast
            </button>
          )}
        </div>

        {/* Notification List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
              <Bell size={36} style={{ opacity: 0.25, margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>No Notifications Yet</div>
              <div style={{ fontSize: '12px', maxWidth: '240px', margin: '0 auto', lineHeight: '1.4' }}>
                Trade signals, market updates, and news will appear here in real time.
              </div>
            </div>
          ) : (
            filtered.map((item) => {
              const isBuy = item.side === 'BUY';
              const isSell = item.side === 'SELL';
              const isSignal = item.type === 'SIGNAL' || isBuy || isSell;
              const isNews = item.type === 'NEWS';

              return (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-panel)',
                    border: isBuy 
                      ? '1px solid rgba(16, 185, 129, 0.4)' 
                      : (isSell 
                        ? '1px solid rgba(239, 68, 68, 0.4)' 
                        : (isNews ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)')),
                    borderRadius: '12px',
                    padding: '14px',
                    position: 'relative',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isBuy && (
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <TrendingUp size={11} /> BUY SIGNAL
                        </span>
                      )}
                      {isSell && (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <TrendingDown size={11} /> SELL SIGNAL
                        </span>
                      )}
                      {isSignal && (
                        <span style={{
                          background: (item.product_type === 'DEL' || item.product_type === 'DELIVERY') ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: (item.product_type === 'DEL' || item.product_type === 'DELIVERY') ? '#C084FC' : '#60A5FA',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '800',
                          border: `1px solid ${(item.product_type === 'DEL' || item.product_type === 'DELIVERY') ? 'rgba(168, 85, 247, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`
                        }}>
                          {(item.product_type === 'DEL' || item.product_type === 'DELIVERY') ? '📦 DELIVERY' : '⚡ INTRADAY'}
                        </span>
                      )}
                      {isNews && (
                        <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA', padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Newspaper size={11} /> MARKET NEWS
                        </span>
                      )}
                      {!isSignal && !isNews && (
                        <span style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#A78BFA', padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Bell size={11} /> ANNOUNCEMENT
                        </span>
                      )}

                      {item.target_tier && item.target_tier !== 'ALL' && (
                        <span style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#FCD34D', padding: '2px 6px', borderRadius: '4px', fontSize: '9.5px', fontWeight: '700' }}>
                          👑 {item.target_tier}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={10} /> {formatTime(item.created_at)}
                      </span>
                      {user?.is_admin && (
                        <button
                          onClick={() => deleteBroadcastNotification(item.id)}
                          title="Delete broadcast"
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                          className="hoverable"
                        >
                          <Trash2 size={13} style={{ color: 'var(--color-red-light)' }} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Signal Card Specifics */}
                  {isSignal ? (
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
                        {item.symbol || item.title}
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '6px',
                        background: 'rgba(0,0,0,0.25)',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        marginBottom: '10px',
                        border: '1px solid var(--border-color)'
                      }}>
                        <div>
                          <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>ENTRY</div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>₹{item.entry_price || 'CMP'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>TARGET</div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: '#10B981' }}>₹{item.target_price || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>STOP LOSS</div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: '#EF4444' }}>₹{item.stop_loss || '—'}</div>
                        </div>
                      </div>

                      {item.message && (
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                          {item.message}
                        </p>
                      )}

                      {item.symbol && (
                        <button
                          onClick={() => handleTrade(item)}
                          style={{
                            width: '100%',
                            padding: '7px 12px',
                            background: isBuy ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isBuy ? '#10B981' : '#EF4444',
                            border: isBuy ? '1px solid #10B981' : '1px solid #EF4444',
                            borderRadius: '6px',
                            fontWeight: '700',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                          className="hoverable"
                        >
                          <Zap size={13} /> Trade {item.symbol} ({item.side})
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {item.title}
                      </div>

                      {item.impact && (
                        <div style={{ marginBottom: '6px', display: 'inline-block', fontSize: '10.5px', fontWeight: '700', padding: '1px 6px', borderRadius: '3px', background: item.impact === 'BULLISH' ? 'rgba(16, 185, 129, 0.15)' : (item.impact === 'BEARISH' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.15)'), color: item.impact === 'BULLISH' ? '#10B981' : (item.impact === 'BEARISH' ? '#EF4444' : '#94A3B8') }}>
                          {item.impact === 'BULLISH' ? '📈 Bullish' : (item.impact === 'BEARISH' ? '📉 Bearish' : '⚖️ Neutral')}
                        </div>
                      )}

                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
                        {item.message}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
