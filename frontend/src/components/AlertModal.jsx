import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore, API } from '../store';
import { X, Bell, Search, Check, TrendingUp, TrendingDown } from 'lucide-react';

const POPULAR_INSTRUMENTS = [
  { label: 'NIFTY 50', symbol: 'NSE:NIFTY50-INDEX' },
  { label: 'BANKNIFTY', symbol: 'NSE:NIFTYBANK-INDEX' },
  { label: 'SENSEX', symbol: 'BSE:SENSEX-INDEX' },
  { label: 'RELIANCE', symbol: 'NSE:RELIANCE-EQ' },
  { label: 'TCS', symbol: 'NSE:TCS-EQ' },
  { label: 'HDFCBANK', symbol: 'NSE:HDFCBANK-EQ' },
  { label: 'INFY', symbol: 'NSE:INFY-EQ' },
  { label: 'TATAMOTORS', symbol: 'NSE:TATAMOTORS-EQ' },
  { label: 'CRUDEOIL', symbol: 'MCX:CRUDEOIL-FUT' }
];

export default function AlertModal() {
  const modalSymbol = useStore(state => state.alertModalSymbol);
  const watchlists = useStore(state => state.watchlists);
  const activeWatchlistId = useStore(state => state.activeWatchlistId);
  const stocks = useStore(state => state.stocks);
  const showToast = useStore(state => state.showToast);
  const { setAlertModalSymbol, addAlert, subscribeToSymbol, fetchBatchPrices, pingSubscriptions } = useStore.getState();

  const [selectedSymbol, setSelectedSymbol] = useState(modalSymbol || 'NSE:NIFTY50-INDEX');
  const [condition, setCondition] = useState('ABOVE');
  const [targetPrice, setTargetPrice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const searchInputRef = useRef(null);

  // Sync when alertModalSymbol opens or changes
  useEffect(() => {
    if (modalSymbol) {
      setSelectedSymbol(modalSymbol);
      setTargetPrice('');
      setCondition('ABOVE');
      setSearchQuery('');
      setSearchResults([]);
      setIsSearchOpen(false);

      if (typeof subscribeToSymbol === 'function') subscribeToSymbol(modalSymbol);
      if (typeof fetchBatchPrices === 'function') fetchBatchPrices([modalSymbol]);
      if (typeof pingSubscriptions === 'function') pingSubscriptions();
    }
  }, [modalSymbol]);

  // Read live LTP for the selected instrument
  const symbol = selectedSymbol;
  const ltp = useStore(state => {
    if (!symbol) return 0;
    const clean = symbol.includes(':') ? symbol.split(':')[1] : symbol;
    const priceObj = state.prices[symbol] || state.prices[clean] || state.prices[`NSE:${clean}`] || state.prices[`BSE:${clean}`] || state.prices[`MCX:${clean}`];
    return Number(priceObj?.ltp || 0);
  });

  const priceObj = useStore(state => {
    if (!selectedSymbol) return null;
    const clean = selectedSymbol.includes(':') ? selectedSymbol.split(':')[1] : selectedSymbol;
    return state.prices[selectedSymbol] || state.prices[clean] || state.prices[`NSE:${clean}`] || state.prices[`BSE:${clean}`] || state.prices[`MCX:${clean}`];
  });

  // Watchlist quick symbols
  const watchlistPills = useMemo(() => {
    const activeWl = (watchlists || []).find(w => String(w.id) === String(activeWatchlistId)) || watchlists?.[0];
    if (!activeWl || !Array.isArray(activeWl.symbols)) return [];
    return activeWl.symbols.slice(0, 6).map(s => {
      const clean = s.includes(':') ? s.split(':')[1] : s;
      return { label: clean.replace('-EQ', '').replace('-INDEX', ''), symbol: s };
    });
  }, [watchlists, activeWatchlistId]);

  // Live instrument search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/stocks/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setSearchResults(data.slice(0, 8));
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          // Fallback to local stocks search
          const localMatches = (stocks || [])
            .filter(s => (s.symbol && s.symbol.toLowerCase().includes(q.toLowerCase())) ||
                         (s.name && s.name.toLowerCase().includes(q.toLowerCase())))
            .slice(0, 8)
            .map(s => ({
              uniqueSymbol: s.uniqueSymbol || `NSE:${s.symbol}`,
              symbol: s.symbol,
              name: s.name,
              exchange: s.exchange || 'NSE'
            }));
          setSearchResults(localMatches);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, stocks]);

  if (!modalSymbol) return null;

  const handleSelectInstrument = (sym) => {
    setSelectedSymbol(sym);
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setTargetPrice('');

    if (typeof subscribeToSymbol === 'function') subscribeToSymbol(sym);
    if (typeof fetchBatchPrices === 'function') fetchBatchPrices([sym]);
    if (typeof pingSubscriptions === 'function') pingSubscriptions();
  };

  const handlePercentTarget = (pct) => {
    if (!ltp || ltp <= 0) return;
    const computed = ltp * (1 + pct / 100);
    setTargetPrice(computed.toFixed(2));
  };

  const handleSave = () => {
    const val = parseFloat(targetPrice);
    if (isNaN(val) || val <= 0) {
      alert("Please enter a valid target price");
      return;
    }

    if (ltp > 0) {
      if (condition === 'ABOVE' && val <= ltp) {
        alert(`Target price for 'ABOVE' alert must be greater than current market price (₹${ltp.toFixed(2)})`);
        return;
      }
      if (condition === 'BELOW' && val >= ltp) {
        alert(`Target price for 'BELOW' alert must be less than current market price (₹${ltp.toFixed(2)})`);
        return;
      }
    }
    
    // Request notification permission if not granted
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    addAlert({
      symbol: selectedSymbol,
      condition,
      targetPrice: val,
      createdPrice: ltp > 0 ? ltp : undefined
    });

    if (typeof showToast === 'function') {
      showToast(`Price alert set for ${selectedSymbol} when price crosses ${condition.toLowerCase()} ₹${val.toFixed(2)}`, 'success', 'Alert Created');
    }

    setAlertModalSymbol(null);
  };

  const cleanSymbolName = selectedSymbol.includes(':') ? selectedSymbol.split(':')[1] : selectedSymbol;
  const exchangeName = selectedSymbol.includes(':') ? selectedSymbol.split(':')[0] : 'NSE';
  const isUp = priceObj && priceObj.change >= 0;

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '16px', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#1E293B', borderRadius: '14px', width: '100%', maxWidth: '440px',
        maxHeight: '90vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', border: '1px solid #334155',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          padding: '16px 20px', borderBottom: '1px solid #334155',
          background: 'rgba(30, 41, 59, 0.8)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: 'rgba(96, 165, 250, 0.15)', padding: '6px', borderRadius: '8px', display: 'flex' }}>
              <Bell size={18} color="#60A5FA" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#F8FAFC' }}>
                Create Price Alert
              </h2>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>Instant notifications when target is reached</div>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setAlertModalSymbol(null)}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Selected Instrument Display Card */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '10px',
            border: '1px solid #334155',
            padding: '14px 16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <span style={{ 
                  fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', 
                  background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA', marginRight: '6px'
                }}>
                  {exchangeName}
                </span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#F8FAFC' }}>
                  {cleanSymbolName}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(!isSearchOpen);
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
                style={{
                  background: isSearchOpen ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  color: isSearchOpen ? '#60A5FA' : '#94A3B8',
                  border: '1px solid #334155',
                  padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <Search size={12} />
                {isSearchOpen ? 'Close Search' : 'Change Stock'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>LTP:</span>
              <span style={{ fontSize: '18px', fontWeight: '800', color: ltp > 0 ? (isUp ? '#10B981' : '#EF4444') : '#94A3B8' }}>
                ₹{ltp > 0 ? ltp.toFixed(2) : 'Loading...'}
              </span>
              {priceObj && priceObj.change !== undefined && (
                <span style={{ fontSize: '12px', fontWeight: '600', color: isUp ? '#10B981' : '#EF4444', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {isUp ? '+' : ''}{Number(priceObj.change).toFixed(2)} ({isUp ? '+' : ''}{Number(priceObj.pct || 0).toFixed(2)}%)
                </span>
              )}
            </div>
          </div>

          {/* Instrument Search & Quick Pills Drawer */}
          {isSearchOpen && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.8)',
              borderRadius: '10px',
              border: '1px solid #3b82f6',
              padding: '12px',
              display: 'flex', flexDirection: 'column', gap: '10px'
            }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '11px' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search stock, index, contract (e.g. Reliance, Nifty, Crude)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px 8px 32px', background: '#0F172A',
                    border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              {/* Live search results */}
              {isSearching && (
                <div style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center', padding: '6px' }}>
                  Searching instruments...
                </div>
              )}

              {searchResults.length > 0 && (
                <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {searchResults.map((item) => {
                    const itemSym = item.uniqueSymbol || item.symbol;
                    const isCurrent = itemSym === selectedSymbol;
                    return (
                      <div
                        key={itemSym}
                        onClick={() => handleSelectInstrument(itemSym)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '7px 10px', borderRadius: '6px', cursor: 'pointer',
                          background: isCurrent ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isCurrent ? '#3b82f6' : '#334155'}`
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {item.symbol}
                            <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)', color: '#94A3B8' }}>
                              {item.exchange || 'NSE'}
                            </span>
                          </div>
                          {item.name && (
                            <div style={{ fontSize: '10px', color: '#94A3B8', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.name}
                            </div>
                          )}
                        </div>
                        {isCurrent && <Check size={14} color="#60A5FA" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick Popular Instruments Chips */}
              <div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: '600' }}>
                  Quick Instruments:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {POPULAR_INSTRUMENTS.map(p => (
                    <button
                      key={p.symbol}
                      type="button"
                      onClick={() => handleSelectInstrument(p.symbol)}
                      style={{
                        background: selectedSymbol === p.symbol ? 'var(--color-blue)' : 'rgba(255, 255, 255, 0.05)',
                        color: selectedSymbol === p.symbol ? '#fff' : '#CBD5E1',
                        border: '1px solid #334155', borderRadius: '14px', padding: '3px 9px',
                        fontSize: '11px', fontWeight: '600', cursor: 'pointer'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Watchlist Chips (if any) */}
              {watchlistPills.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: '600' }}>
                    From Your Watchlist:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {watchlistPills.map(wp => (
                      <button
                        key={wp.symbol}
                        type="button"
                        onClick={() => handleSelectInstrument(wp.symbol)}
                        style={{
                          background: selectedSymbol === wp.symbol ? 'var(--color-blue)' : 'rgba(255, 255, 255, 0.05)',
                          color: selectedSymbol === wp.symbol ? '#fff' : '#CBD5E1',
                          border: '1px solid #334155', borderRadius: '14px', padding: '3px 9px',
                          fontSize: '11px', fontWeight: '600', cursor: 'pointer'
                        }}
                      >
                        {wp.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Condition and Target Price Inputs */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: '600' }}>
                Condition
              </label>
              <select 
                value={condition} 
                onChange={(e) => setCondition(e.target.value)}
                style={{
                  width: '100%', padding: '10px', background: '#0F172A', border: '1px solid #334155',
                  borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none'
                }}
              >
                <option value="ABOVE">Crosses Above (≥)</option>
                <option value="BELOW">Crosses Below (≤)</option>
              </select>
            </div>
            
            <div style={{ flex: 1.2 }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: '600' }}>
                Target Price (₹)
              </label>
              <input 
                type="number"
                step="any"
                placeholder={ltp > 0 ? (condition === 'ABOVE' ? `e.g. ${(ltp * 1.01).toFixed(2)}` : `e.g. ${(ltp * 0.99).toFixed(2)}`) : 'e.g. 150'}
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                style={{
                  width: '100%', padding: '10px', background: '#0F172A', border: '1px solid #334155',
                  borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Quick Target Percentage Pills (Based on live LTP) */}
          {ltp > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '6px' }}>
                Quick Target Levels:
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {condition === 'ABOVE' ? (
                  [0.5, 1.0, 2.0, 5.0].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handlePercentTarget(pct)}
                      style={{
                        flex: 1, padding: '5px 0', background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '6px',
                        color: '#10B981', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      +{pct}%
                    </button>
                  ))
                ) : (
                  [-0.5, -1.0, -2.0, -5.0].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handlePercentTarget(pct)}
                      style={{
                        flex: 1, padding: '5px 0', background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px',
                        color: '#EF4444', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      {pct}%
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Save Button */}
          <button 
            type="button"
            onClick={handleSave}
            style={{
              width: '100%', background: 'var(--color-blue)', color: '#fff', border: 'none',
              padding: '13px', borderRadius: '8px', fontSize: '14px', fontWeight: '800',
              cursor: 'pointer', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            <Bell size={16} /> SET ALERT
          </button>
        </div>
      </div>
    </div>
  );
}
