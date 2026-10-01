import React, { useState } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { X, TrendingUp, TrendingDown, Newspaper, Bell, Send, Trash2, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';

export default function BroadcastModal({ isOpen, onClose }) {
  const { sendBroadcastNotification, broadcastNotifications, deleteBroadcastNotification } = useStore(
    useShallow(state => ({
      sendBroadcastNotification: state.sendBroadcastNotification,
      broadcastNotifications: state.broadcastNotifications || [],
      deleteBroadcastNotification: state.deleteBroadcastNotification
    }))
  );

  const [activeTab, setActiveTab] = useState('SIGNAL'); // 'SIGNAL', 'NEWS', 'ANNOUNCEMENT', 'HISTORY'
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [signalSide, setSignalSide] = useState('BUY'); // 'BUY' or 'SELL'
  const [symbol, setSymbol] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [message, setMessage] = useState('');
  
  const [newsTitle, setNewsTitle] = useState('');
  const [newsImpact, setNewsImpact] = useState('BULLISH'); // 'BULLISH', 'BEARISH', 'NEUTRAL'
  const [newsBody, setNewsBody] = useState('');

  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');

  const [targetTier, setTargetTier] = useState('ALL'); // 'ALL', 'MONTHLY_PLUS', 'YEARLY_PLUS', 'HIGHEST_ONLY'
  const [showBanner, setShowBanner] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    let payload = {};
    if (activeTab === 'SIGNAL') {
      if (!symbol.trim()) {
        alert('Please enter a trading symbol (e.g. NSE:RELIANCE or NIFTY24OCT25000CE)');
        setSubmitting(false);
        return;
      }
      payload = {
        type: 'SIGNAL',
        side: signalSide,
        symbol: symbol.trim().toUpperCase(),
        entry_price: entryPrice,
        target_price: targetPrice,
        stop_loss: stopLoss,
        message: message.trim(),
        target_tier: targetTier,
        show_banner: showBanner
      };
    } else if (activeTab === 'NEWS') {
      if (!newsTitle.trim()) {
        alert('Please enter a news headline');
        setSubmitting(false);
        return;
      }
      payload = {
        type: 'NEWS',
        title: newsTitle.trim(),
        impact: newsImpact,
        message: newsBody.trim(),
        target_tier: targetTier,
        show_banner: showBanner
      };
    } else if (activeTab === 'ANNOUNCEMENT') {
      if (!announcementBody.trim()) {
        alert('Please enter an announcement message');
        setSubmitting(false);
        return;
      }
      payload = {
        type: 'ANNOUNCEMENT',
        title: announcementTitle.trim() || 'Platform Announcement',
        message: announcementBody.trim(),
        target_tier: targetTier,
        show_banner: showBanner
      };
    }

    try {
      const res = await sendBroadcastNotification(payload);
      if (res?.success) {
        alert('Broadcast successfully sent in real-time to traders!');
        // Reset form
        setSymbol('');
        setEntryPrice('');
        setTargetPrice('');
        setStopLoss('');
        setMessage('');
        setNewsTitle('');
        setNewsBody('');
        setAnnouncementTitle('');
        setAnnouncementBody('');
        setShowBanner(false);
        onClose();
      } else {
        alert(res?.error || 'Failed to send broadcast');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      animation: 'fadeIn 0.2s ease-out'
    }} onClick={onClose}>
      <div 
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          background: 'var(--bg-panel, #1e293b)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', padding: '8px', borderRadius: '10px', color: '#fff' }}>
              <Bell size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                Broadcast Studio
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Publish real-time Buy/Sell calls, market news, or announcements
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px' }}
            className="hoverable"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.1)'
        }}>
          {[
            { id: 'SIGNAL', label: '🎯 Trade Signal (Buy / Sell)', icon: TrendingUp },
            { id: 'NEWS', label: '📰 Market News', icon: Newspaper },
            { id: 'ANNOUNCEMENT', label: '📢 Announcement', icon: Bell },
            { id: 'HISTORY', label: '📜 Recent Broadcasts', icon: Eye }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '12px 10px',
                background: activeTab === tab.id ? 'var(--bg-panel)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-blue)' : '2px solid transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                fontWeight: activeTab === tab.id ? '700' : '500',
                fontSize: '12.5px',
                cursor: 'pointer',
                transition: '0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {activeTab === 'HISTORY' ? (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '14px', color: 'var(--text-primary)' }}>
                Active Broadcast Notifications ({broadcastNotifications.length})
              </h4>
              {broadcastNotifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  No active broadcasts found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {broadcastNotifications.map(n => (
                    <div 
                      key={n.id} 
                      style={{ 
                        background: 'rgba(0,0,0,0.2)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '10px', 
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: '800', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            background: n.side === 'BUY' ? 'rgba(16, 185, 129, 0.2)' : (n.side === 'SELL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'),
                            color: n.side === 'BUY' ? '#10B981' : (n.side === 'SELL' ? '#EF4444' : '#60A5FA')
                          }}>
                            {n.type === 'SIGNAL' ? `${n.side} ${n.symbol}` : n.type}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {n.title}
                          </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          {n.message || `Entry: ₹${n.entry_price || 'CMP'} | Target: ₹${n.target_price || '—'} | SL: ₹${n.stop_loss || '—'}`}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteBroadcastNotification(n.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#EF4444',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        className="hoverable"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* SIGNAL TAB */}
              {activeTab === 'SIGNAL' && (
                <>
                  {/* BUY / SELL Toggle */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                      CALL ACTION
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setSignalSide('BUY')}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: signalSide === 'BUY' ? '2px solid #10B981' : '1px solid var(--border-color)',
                          background: signalSide === 'BUY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                          color: signalSide === 'BUY' ? '#10B981' : 'var(--text-secondary)',
                          fontWeight: '800',
                          fontSize: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <TrendingUp size={16} /> 🟢 BUY CALL
                      </button>
                      <button
                        type="button"
                        onClick={() => setSignalSide('SELL')}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: signalSide === 'SELL' ? '2px solid #EF4444' : '1px solid var(--border-color)',
                          background: signalSide === 'SELL' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0,0,0,0.2)',
                          color: signalSide === 'SELL' ? '#EF4444' : 'var(--text-secondary)',
                          fontWeight: '800',
                          fontSize: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <TrendingDown size={16} /> 🔴 SELL CALL
                      </button>
                    </div>
                  </div>

                  {/* Symbol Input */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      TRADING SYMBOL *
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. NSE:RELIANCE or NIFTY24OCT25000CE or MCX:CRUDEOILM"
                      value={symbol}
                      onChange={e => setSymbol(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13.5px', textTransform: 'uppercase' }}
                    />
                  </div>

                  {/* Price Levels Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        ENTRY PRICE (₹)
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="CMP or 2450.50"
                        value={entryPrice}
                        onChange={e => setEntryPrice(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#10B981', display: 'block', marginBottom: '4px' }}>
                        TARGET (₹)
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="2500.00"
                        value={targetPrice}
                        onChange={e => setTargetPrice(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#EF4444', display: 'block', marginBottom: '4px' }}>
                        STOP LOSS (₹)
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="2420.00"
                        value={stopLoss}
                        onChange={e => setStopLoss(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  {/* Notes / Strategy */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      STRATEGY RATIONALE / REMARKS (OPTIONAL)
                    </label>
                    <textarea
                      className="input-field"
                      placeholder="e.g. Bullish pennant breakout on 15m chart with high volume confirmation."
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '10px 12px', fontSize: '12.5px', resize: 'vertical' }}
                    />
                  </div>
                </>
              )}

              {/* NEWS TAB */}
              {activeTab === 'NEWS' && (
                <>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      NEWS HEADLINE *
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. US Fed Signals Imminent Rate Cuts; Global Markets Rally"
                      value={newsTitle}
                      onChange={e => setNewsTitle(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13.5px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      MARKET IMPACT
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      {[
                        { id: 'BULLISH', label: '📈 Bullish', color: '#10B981' },
                        { id: 'BEARISH', label: '📉 Bearish', color: '#EF4444' },
                        { id: 'NEUTRAL', label: '⚖️ Neutral', color: '#94A3B8' }
                      ].map(imp => (
                        <button
                          key={imp.id}
                          type="button"
                          onClick={() => setNewsImpact(imp.id)}
                          style={{
                            padding: '8px',
                            borderRadius: '6px',
                            border: newsImpact === imp.id ? `2px solid ${imp.color}` : '1px solid var(--border-color)',
                            background: newsImpact === imp.id ? `${imp.color}22` : 'rgba(0,0,0,0.2)',
                            color: newsImpact === imp.id ? imp.color : 'var(--text-secondary)',
                            fontWeight: '700',
                            fontSize: '12.5px',
                            cursor: 'pointer'
                          }}
                        >
                          {imp.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      NEWS SUMMARY & DETAILS
                    </label>
                    <textarea
                      className="input-field"
                      placeholder="Enter detailed points, sectors affected, and key takeaways for traders..."
                      value={newsBody}
                      onChange={e => setNewsBody(e.target.value)}
                      rows={3}
                      style={{ width: '100%', padding: '10px 12px', fontSize: '12.5px', resize: 'vertical' }}
                    />
                  </div>
                </>
              )}

              {/* ANNOUNCEMENT TAB */}
              {activeTab === 'ANNOUNCEMENT' && (
                <>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      ANNOUNCEMENT TITLE (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Scheduled System Maintenance / Tournament Launch"
                      value={announcementTitle}
                      onChange={e => setAnnouncementTitle(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13.5px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      MESSAGE BODY *
                    </label>
                    <textarea
                      className="input-field"
                      placeholder="Enter the official announcement text to broadcast..."
                      value={announcementBody}
                      onChange={e => setAnnouncementBody(e.target.value)}
                      required
                      rows={3}
                      style={{ width: '100%', padding: '10px 12px', fontSize: '12.5px', resize: 'vertical' }}
                    />
                  </div>
                </>
              )}

              {/* Targeting & Delivery Controls */}
              <div style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    TARGET AUDIENCE PLAN
                  </label>
                  <select
                    className="input-field"
                    value={targetTier}
                    onChange={e => setTargetTier(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12.5px' }}
                  >
                    <option value="ALL">🌐 All Traders (Free Normal + Paid Plans)</option>
                    <option value="MONTHLY_PLUS">⚡ Pro Monthly & Above (Paid Only)</option>
                    <option value="YEARLY_PLUS">⭐ Yearly Elite & Feature Plan Only</option>
                    <option value="HIGHEST_ONLY">👑 Feature Plan VIP Members Exclusive</option>
                  </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-primary)', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showBanner}
                    onChange={e => setShowBanner(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-blue)', cursor: 'pointer' }}
                  />
                  <span>📌 Also display as a Sticky Top Banner in traders' browsers</span>
                </label>
              </div>

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{ padding: '10px 18px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary hoverable"
                  disabled={submitting}
                  style={{
                    padding: '10px 22px',
                    fontSize: '13px',
                    fontWeight: '800',
                    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(37,99,235,0.4)'
                  }}
                >
                  <Send size={15} /> {submitting ? 'Broadcasting...' : 'Broadcast to Traders Now'}
                </button>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
