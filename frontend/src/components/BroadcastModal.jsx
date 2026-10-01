import React, { useState, useEffect, useRef } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { 
  X, TrendingUp, TrendingDown, Newspaper, Bell, Send, Trash2, 
  CheckCircle2, AlertTriangle, Eye, Search, Layers, Sparkles, 
  Loader2, Check, ArrowRight, CornerDownLeft, RotateCcw
} from 'lucide-react';
import { getInstantLotsize, isDerivativeContract, isCommodityContract } from '../utils/lotsizeHelper';

const POPULAR_INSTRUMENTS = [
  { uniqueSymbol: 'NSE:NIFTY50-INDEX', symbol: 'NIFTY50', name: 'Nifty 50 Index', exchange: 'NSE', type: 'INDEX' },
  { uniqueSymbol: 'NSE:NIFTYBANK-INDEX', symbol: 'BANKNIFTY', name: 'Bank Nifty Index', exchange: 'NSE', type: 'INDEX' },
  { uniqueSymbol: 'NSE:RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'NSE', type: 'EQUITY' },
  { uniqueSymbol: 'NSE:HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'NSE', type: 'EQUITY' },
  { uniqueSymbol: 'NSE:TATAMOTORS', symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', exchange: 'NSE', type: 'EQUITY' },
  { uniqueSymbol: 'MCX:CRUDEOILM', symbol: 'CRUDEOILM', name: 'Crude Oil Mini Future', exchange: 'MCX', type: 'COMMODITY' },
  { uniqueSymbol: 'MCX:GOLDM', symbol: 'GOLDM', name: 'Gold Mini Future', exchange: 'MCX', type: 'COMMODITY' },
  { uniqueSymbol: 'MCX:SILVERM', symbol: 'SILVERM', name: 'Silver Mini Future', exchange: 'MCX', type: 'COMMODITY' },
  { uniqueSymbol: 'MCX:NATURALGAS', symbol: 'NATURALGAS', name: 'Natural Gas Future', exchange: 'MCX', type: 'COMMODITY' },
];

export default function BroadcastModal({ isOpen, onClose }) {
  const { sendBroadcastNotification, broadcastNotifications, deleteBroadcastNotification, prices } = useStore(
    useShallow(state => ({
      sendBroadcastNotification: state.sendBroadcastNotification,
      broadcastNotifications: state.broadcastNotifications || [],
      deleteBroadcastNotification: state.deleteBroadcastNotification,
      prices: state.prices || {}
    }))
  );

  const [activeTab, setActiveTab] = useState('SIGNAL'); // 'SIGNAL', 'NEWS', 'ANNOUNCEMENT', 'HISTORY'
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [signalSide, setSignalSide] = useState('BUY'); // 'BUY' or 'SELL'
  const [productType, setProductType] = useState('INT'); // 'INT' (Intraday) or 'DEL' (Delivery / Overnight)
  const [symbol, setSymbol] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [message, setMessage] = useState('');
  
  // Symbol search states
  const [selectedStockData, setSelectedStockData] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchSegment, setSearchSegment] = useState('ALL'); // 'ALL', 'EQUITY', 'FNO', 'MCX'
  const searchContainerRef = useRef(null);

  const [newsTitle, setNewsTitle] = useState('');
  const [newsImpact, setNewsImpact] = useState('BULLISH'); // 'BULLISH', 'BEARISH', 'NEUTRAL'
  const [newsBody, setNewsBody] = useState('');

  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');

  const [targetTier, setTargetTier] = useState('ALL'); // 'ALL', 'MONTHLY_PLUS', 'YEARLY_PLUS', 'HIGHEST_ONLY'
  const [showBanner, setShowBanner] = useState(false);

  // Classification helpers
  const isMcx = (item) => {
    if (!item) return false;
    const sym = (item.uniqueSymbol || item.symbol || '').toUpperCase();
    const ex = (item.exchange || '').toUpperCase();
    return ex === 'MCX' || isCommodityContract(sym);
  };

  const isFno = (item) => {
    if (!item) return false;
    const sym = (item.uniqueSymbol || item.symbol || '').toUpperCase();
    return isDerivativeContract(sym) || /FUT|CE|PE/i.test(sym);
  };

  const isEquity = (item) => {
    return !isMcx(item) && !isFno(item);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search query to backend
  useEffect(() => {
    if (!symbol || symbol.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (selectedStockData && (selectedStockData.uniqueSymbol === symbol || selectedStockData.symbol === symbol)) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const cleanQuery = symbol.replace(/^(NSE:|BSE:|MCX:)/i, '').trim();
        const res = await fetch(`${API}/api/stocks/search?q=${encodeURIComponent(cleanQuery || symbol)}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          setSearchResults(list);
          setIsSearchOpen(true);
          if (list.length > 0) {
            useStore.getState().fetchBatchPrices?.(list.map(d => d.uniqueSymbol || d.symbol));
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Symbol search error:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [symbol, selectedStockData]);

  if (!isOpen) return null;

  // Handle instrument select from autocomplete
  const handleSelectInstrument = (item) => {
    const targetSymbol = item.uniqueSymbol || item.symbol;
    setSymbol(targetSymbol);
    setSelectedStockData(item);
    setIsSearchOpen(false);

    // Live price resolution
    const priceData = prices[targetSymbol] || prices[item.symbol];
    const ltp = priceData?.ltp !== undefined ? Number(priceData.ltp) : (Number(item.ltp) || null);

    if (ltp && (!entryPrice || entryPrice === 'CMP')) {
      setEntryPrice(ltp.toFixed(2));
      const factor = signalSide === 'BUY' ? 1.015 : 0.985;
      const slFactor = signalSide === 'BUY' ? 0.99 : 1.01;
      setTargetPrice((ltp * factor).toFixed(2));
      setStopLoss((ltp * slFactor).toFixed(2));
    }
  };

  const handleSideChange = (newSide) => {
    setSignalSide(newSide);
    const numEntry = parseFloat(entryPrice);
    if (!isNaN(numEntry) && numEntry > 0) {
      const factor = newSide === 'BUY' ? 1.015 : 0.985;
      const slFactor = newSide === 'BUY' ? 0.99 : 1.01;
      setTargetPrice((numEntry * factor).toFixed(2));
      setStopLoss((numEntry * slFactor).toFixed(2));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    let payload = {};
    if (activeTab === 'SIGNAL') {
      if (!symbol.trim()) {
        alert('Please enter a trading symbol (e.g. NSE:RELIANCE or NIFTY24OCT25000CE or MCX:CRUDEOILM)');
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
        product_type: productType,
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
        setSelectedStockData(null);
        setProductType('INT');
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

  // Compute segment breakdown for results
  const baseList = searchResults.length > 0 ? searchResults : POPULAR_INSTRUMENTS;
  const equityCount = baseList.filter(isEquity).length;
  const fnoCount = baseList.filter(isFno).length;
  const mcxCount = baseList.filter(isMcx).length;

  const displayList = baseList.filter(item => {
    if (searchSegment === 'ALL') return true;
    if (searchSegment === 'EQUITY') return isEquity(item);
    if (searchSegment === 'FNO') return isFno(item);
    if (searchSegment === 'MCX') return isMcx(item);
    return true;
  });

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
      padding: '20px'
    }} onClick={onClose}>
      <div 
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          background: 'var(--bg-card, #131722)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleIn 0.2s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
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
                          {n.type === 'SIGNAL' && (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '800',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: (n.product_type === 'DEL' || n.product_type === 'DELIVERY') ? 'rgba(139, 92, 246, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                              color: (n.product_type === 'DEL' || n.product_type === 'DELIVERY') ? '#C084FC' : '#60A5FA',
                              border: `1px solid ${(n.product_type === 'DEL' || n.product_type === 'DELIVERY') ? 'rgba(139, 92, 246, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`
                            }}>
                              {(n.product_type === 'DEL' || n.product_type === 'DELIVERY') ? '📦 DELIVERY' : '⚡ INTRADAY'}
                            </span>
                          )}
                          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {n.title}
                          </span>
                        </div>
                        {n.type === 'SIGNAL' && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
                            <span>Entry: ₹{n.entry_price || '—'}</span>
                            <span style={{ color: '#10B981' }}>Target: ₹{n.target_price || '—'}</span>
                            <span style={{ color: '#EF4444' }}>SL: ₹{n.stop_loss || '—'}</span>
                          </div>
                        )}
                        {n.message && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {n.message}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete and revoke this broadcast?')) {
                            deleteBroadcastNotification(n.id);
                          }
                        }}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#EF4444',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        <Trash2 size={13} /> Revoke
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
                  {/* Call Action & Product Type Row (BUY/SELL & INTRADAY/DELIVERY) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    {/* BUY / SELL Toggle */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                        CALL ACTION
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleSideChange('BUY')}
                          style={{
                            padding: '11px 8px',
                            borderRadius: '8px',
                            border: signalSide === 'BUY' ? '2px solid #10B981' : '1px solid var(--border-color)',
                            background: signalSide === 'BUY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                            color: signalSide === 'BUY' ? '#10B981' : 'var(--text-secondary)',
                            fontWeight: '800',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <TrendingUp size={15} /> 🟢 BUY
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSideChange('SELL')}
                          style={{
                            padding: '11px 8px',
                            borderRadius: '8px',
                            border: signalSide === 'SELL' ? '2px solid #EF4444' : '1px solid var(--border-color)',
                            background: signalSide === 'SELL' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0,0,0,0.2)',
                            color: signalSide === 'SELL' ? '#EF4444' : 'var(--text-secondary)',
                            fontWeight: '800',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <TrendingDown size={15} /> 🔴 SELL
                        </button>
                      </div>
                    </div>

                    {/* PRODUCT TYPE (INTRADAY vs DELIVERY) */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                        TRADE TYPE (PRODUCT)
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setProductType('INT')}
                          style={{
                            padding: '11px 8px',
                            borderRadius: '8px',
                            border: productType === 'INT' ? '2px solid #3B82F6' : '1px solid var(--border-color)',
                            background: productType === 'INT' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(0,0,0,0.2)',
                            color: productType === 'INT' ? '#60A5FA' : 'var(--text-secondary)',
                            fontWeight: '800',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span>⚡</span> INTRADAY
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductType('DEL')}
                          style={{
                            padding: '11px 8px',
                            borderRadius: '8px',
                            border: productType === 'DEL' ? '2px solid #8B5CF6' : '1px solid var(--border-color)',
                            background: productType === 'DEL' ? 'rgba(139, 92, 246, 0.18)' : 'rgba(0,0,0,0.2)',
                            color: productType === 'DEL' ? '#A78BFA' : 'var(--text-secondary)',
                            fontWeight: '800',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span>📦</span> DELIVERY
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Symbol Search & Autocomplete Input (Stocks, F&O Derivatives, MCX Commodities) */}
                  <div ref={searchContainerRef} style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                        TRADING SYMBOL *
                      </label>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Search Stocks, Derivatives (F&O) or MCX Commodities
                      </span>
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Search size={16} style={{ position: 'absolute', left: '12px', color: isSearchOpen ? '#38bdf8' : 'var(--text-secondary)', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Search Symbol (e.g. RELIANCE, NIFTY 25000 CE, CRUDEOIL)..."
                        value={symbol}
                        onFocus={() => setIsSearchOpen(true)}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setSymbol(val);
                          setIsSearchOpen(true);
                          if (selectedStockData && selectedStockData.uniqueSymbol !== val) {
                            setSelectedStockData(null);
                          }
                        }}
                        required
                        style={{
                          width: '100%',
                          padding: '11px 40px 11px 36px',
                          fontSize: '13.5px',
                          textTransform: 'uppercase',
                          fontWeight: '700',
                          letterSpacing: '0.5px',
                          borderRadius: '8px',
                          border: isSearchOpen ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                          boxShadow: isSearchOpen ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none'
                        }}
                      />
                      <div style={{ position: 'absolute', right: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isSearching && (
                          <Loader2 size={16} className="animate-spin" color="var(--color-blue)" />
                        )}
                        {symbol && (
                          <button
                            type="button"
                            onClick={() => {
                              setSymbol('');
                              setSelectedStockData(null);
                              setSearchResults([]);
                              setEntryPrice('');
                              setTargetPrice('');
                              setStopLoss('');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Clear Symbol"
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Verified Instrument Details Card */}
                    {selectedStockData && (
                      <div style={{
                        marginTop: '8px',
                        padding: '10px 14px',
                        background: 'rgba(30, 58, 138, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '800',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: isMcx(selectedStockData) ? 'rgba(245, 158, 11, 0.25)' : (isFno(selectedStockData) ? 'rgba(168, 85, 247, 0.25)' : 'rgba(59, 130, 246, 0.25)'),
                            color: isMcx(selectedStockData) ? '#F59E0B' : (isFno(selectedStockData) ? '#C084FC' : '#60A5FA'),
                            border: `1px solid ${isMcx(selectedStockData) ? 'rgba(245, 158, 11, 0.4)' : (isFno(selectedStockData) ? 'rgba(168, 85, 247, 0.4)' : 'rgba(59, 130, 246, 0.4)')}`
                          }}>
                            {isMcx(selectedStockData) ? '🪙 MCX COMMODITY' : (isFno(selectedStockData) ? '⚡ F&O DERIVATIVE' : '📈 CASH EQUITY')}
                          </span>
                          <div>
                            <div style={{ fontWeight: '800', fontSize: '13px', color: '#fff' }}>
                              {selectedStockData.uniqueSymbol || selectedStockData.symbol}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {selectedStockData.name || selectedStockData.description || 'Verified Contract'}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Lot Size: <strong style={{ color: '#fff' }}>{getInstantLotsize(selectedStockData.uniqueSymbol || selectedStockData.symbol)}</strong>
                          </div>
                          {prices[selectedStockData.uniqueSymbol]?.ltp !== undefined && (
                            <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--color-green-light)' }}>
                              CMP: ₹{Number(prices[selectedStockData.uniqueSymbol].ltp).toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Autocomplete Dropdown List */}
                    {isSearchOpen && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: 'var(--bg-dark, #0f172a)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7)',
                        zIndex: 1000,
                        overflow: 'hidden',
                        maxHeight: '340px',
                        display: 'flex',
                        flexDirection: 'column',
                        backdropFilter: 'blur(12px)'
                      }}>
                        {/* Segment Filter Header Tabs */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          borderBottom: '1px solid var(--border-color)',
                          background: 'rgba(0,0,0,0.3)',
                          overflowX: 'auto'
                        }} className="scrollbar-hide">
                          {[
                            { id: 'ALL', label: `All (${searchResults.length || POPULAR_INSTRUMENTS.length})` },
                            { id: 'EQUITY', label: `📈 Stocks (${equityCount})` },
                            { id: 'FNO', label: `⚡ F&O (${fnoCount})` },
                            { id: 'MCX', label: `🪙 MCX (${mcxCount})` }
                          ].map(seg => (
                            <button
                              key={seg.id}
                              type="button"
                              onClick={() => setSearchSegment(seg.id)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: '700',
                                borderRadius: '6px',
                                border: searchSegment === seg.id ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                                background: searchSegment === seg.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.04)',
                                color: searchSegment === seg.id ? '#60A5FA' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {seg.label}
                            </button>
                          ))}
                        </div>

                        {/* List of items */}
                        <div style={{ flex: 1, overflowY: 'auto' }} className="scrollbar-dark">
                          {displayList.length === 0 ? (
                            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                              {isSearching ? 'Searching instruments...' : `No instruments found matching "${symbol}"`}
                            </div>
                          ) : (
                            displayList.map(item => {
                              const itemSym = item.uniqueSymbol || item.symbol;
                              const itemPrice = prices[itemSym] || prices[item.symbol];
                              const ltp = itemPrice?.ltp !== undefined ? Number(itemPrice.ltp) : (Number(item.ltp) || null);
                              const isItemMcx = isMcx(item);
                              const isItemFno = isFno(item);
                              const lot = getInstantLotsize(itemSym);

                              return (
                                <div
                                  key={itemSym}
                                  onClick={() => handleSelectInstrument(item)}
                                  style={{
                                    padding: '9px 14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s ease'
                                  }}
                                  className="hover:bg-blue-600/10"
                                >
                                  {/* Left: Badge, Symbol, Name */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{
                                      fontSize: '9.5px',
                                      fontWeight: '800',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      minWidth: '42px',
                                      textAlign: 'center',
                                      background: isItemMcx ? 'rgba(245, 158, 11, 0.2)' : (isItemFno ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)'),
                                      color: isItemMcx ? '#F59E0B' : (isItemFno ? '#C084FC' : '#60A5FA'),
                                      border: `1px solid ${isItemMcx ? 'rgba(245, 158, 11, 0.35)' : (isItemFno ? 'rgba(168, 85, 247, 0.35)' : 'rgba(59, 130, 246, 0.35)')}`
                                    }}>
                                      {isItemMcx ? 'MCX' : (isItemFno ? 'F&O' : (item.exchange || 'NSE'))}
                                    </span>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontWeight: '800', fontSize: '12.5px', color: '#fff' }}>
                                          {item.symbol || itemSym}
                                        </span>
                                        {lot > 1 && (
                                          <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px', color: 'var(--text-secondary)' }}>
                                            Lot {lot}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                                        {item.name || item.description || itemSym}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right: LTP Price and Action */}
                                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {ltp !== null ? (
                                      <div>
                                        <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-primary)' }}>
                                          ₹{ltp.toFixed(2)}
                                        </div>
                                        <div style={{ fontSize: '9px', color: 'var(--color-green-light)' }}>
                                          ● Live
                                        </div>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                                    )}
                                    <span style={{
                                      fontSize: '11px',
                                      color: 'var(--color-blue)',
                                      fontWeight: '700',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '2px'
                                    }}>
                                      Select <ArrowRight size={12} />
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
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

                  {/* Strategy Notes */}
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      STRATEGY RATIONALE / REMARKS (OPTIONAL)
                    </label>
                    <textarea
                      className="input-field"
                      placeholder="e.g. Bullish pennant breakout on 15m chart with high volume confirmation."
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '12px', resize: 'vertical' }}
                    />
                  </div>
                </>
              )}

              {/* NEWS TAB */}
              {activeTab === 'NEWS' && (
                <>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      NEWS HEADLINE *
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. RBI Keeps Repo Rate Unchanged at 6.50% in MPC Meet"
                      value={newsTitle}
                      onChange={e => setNewsTitle(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13.5px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      MARKET IMPACT / SENTIMENT
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      {[
                        { id: 'BULLISH', label: '🟢 Bullish Impact', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
                        { id: 'BEARISH', label: '🔴 Bearish Impact', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
                        { id: 'NEUTRAL', label: '⚪ Neutral / Info', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)' }
                      ].map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setNewsImpact(item.id)}
                          style={{
                            padding: '10px 8px',
                            borderRadius: '8px',
                            border: newsImpact === item.id ? `2px solid ${item.color}` : '1px solid var(--border-color)',
                            background: newsImpact === item.id ? item.bg : 'rgba(0,0,0,0.2)',
                            color: newsImpact === item.id ? item.color : 'var(--text-secondary)',
                            fontWeight: '700',
                            fontSize: '12px',
                            cursor: 'pointer',
                            textAlign: 'center'
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      NEWS DETAILS / KEY TAKEAWAYS
                    </label>
                    <textarea
                      className="input-field"
                      placeholder="Summary of the news, key sectors affected (e.g. Banking, Auto), and what traders should watch for..."
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
                    <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      ANNOUNCEMENT TITLE (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Scheduled Platform Maintenance Tonight at 11:30 PM IST"
                      value={announcementTitle}
                      onChange={e => setAnnouncementTitle(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
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
