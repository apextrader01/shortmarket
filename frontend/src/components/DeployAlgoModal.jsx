import React, { useState, useEffect, useMemo } from 'react';
import { X, Zap } from 'lucide-react';
import { useStore } from '../store';

const POPULAR_INSTRUMENTS = [
  { symbol: 'NSE:NIFTY50-INDEX', name: 'Nifty 50 Index', type: 'INDEX_FNO', ltp: 24850.00, lotSize: 75 },
  { symbol: 'NSE:BANKNIFTY-INDEX', name: 'Nifty Bank Index', type: 'INDEX_FNO', ltp: 51240.00, lotSize: 30 },
  { symbol: 'NSE:RELIANCE', name: 'Reliance Industries', type: 'EQUITY', ltp: 1285.40, lotSize: 50 },
  { symbol: 'NSE:HDFCBANK', name: 'HDFC Bank Ltd', type: 'EQUITY', ltp: 1682.10, lotSize: 50 },
  { symbol: 'NSE:TCS', name: 'Tata Consultancy Services', type: 'EQUITY', ltp: 3940.00, lotSize: 25 },
  { symbol: 'NSE:INFY', name: 'Infosys Ltd', type: 'EQUITY', ltp: 1860.50, lotSize: 50 },
  { symbol: 'NSE:ICICIBANK', name: 'ICICI Bank Ltd', type: 'EQUITY', ltp: 1265.00, lotSize: 50 },
  { symbol: 'NSE:SBIN', name: 'State Bank of India', type: 'EQUITY', ltp: 815.20, lotSize: 100 },
  { symbol: 'NSE:TATAMOTORS', name: 'Tata Motors Ltd', type: 'EQUITY', ltp: 785.00, lotSize: 100 },
  { symbol: 'NSE:AXISBANK', name: 'Axis Bank Ltd', type: 'EQUITY', ltp: 1145.00, lotSize: 50 }
];

const STRATEGY_TEMPLATES = [
  { id: 'EMA 9/21 Trend Scalper', name: 'EMA 9/21 Trend Scalper', desc: 'Fast momentum scalper on 3-min chart with ATR trailing filter', target: 60, sl: 25 },
  { id: '9:20 AM Short Straddle', name: '9:20 AM Short Straddle', desc: 'Sells ATM CE + PE with 25% SL on both legs at market open', target: 110, sl: 55 },
  { id: 'Supertrend 7/3 Breakout', name: 'Supertrend 7/3 Breakout', desc: 'Trend continuation with adaptive dynamic volatility bands', target: 80, sl: 35 },
  { id: 'VWAP Mean Reversion', name: 'VWAP Mean Reversion', desc: 'Institutional volume weighted average price pullback engine', target: 25, sl: 12 },
  { id: '15-Min ORB Breakout', name: '15-Min ORB Breakout', desc: 'Opening range breakout of high/low with volume confirmation', target: 50, sl: 20 },
  { id: 'Delta-Neutral Seller', name: 'Delta-Neutral Seller', desc: 'Theta decay harvester with automatic Greek adjustments', target: 150, sl: 60 }
];

export default function DeployAlgoModal({ isOpen, onClose, onDeploy, editingItem = null, editingAlgo = null }) {
  const activeEditing = editingItem || editingAlgo;
  const marketStocks = useStore(s => s.stocks);
  const theme = useStore(s => s.theme);
  const isLight = theme === 'light' || (!theme && typeof document !== 'undefined' && document.documentElement.classList.contains('light-theme'));
  const [symbol, setSymbol] = useState('NSE:RELIANCE');
  const [customSymbol, setCustomSymbol] = useState('');
  const [strategy, setStrategy] = useState('EMA 9/21 Trend Scalper');
  const [mode, setMode] = useState('LIVE');
  const [lots, setLots] = useState(1);
  const [targetPts, setTargetPts] = useState(60);
  const [slPts, setSlPts] = useState(25);
  const [trailingSl, setTrailingSl] = useState(true);
  const [autoSquareOff, setAutoSquareOff] = useState('15:15');

  const instrumentList = useMemo(() => {
    return POPULAR_INSTRUMENTS.map(inst => {
      const clean = inst.symbol.split(':')[1] || inst.symbol;
      const live = Array.isArray(marketStocks)
        ? marketStocks.find(s => String(s.symbol || '').toUpperCase() === clean)
        : null;
      if (live && Number(live.price || live.ltp) > 0) {
        return {
          ...inst,
          ltp: Number(live.price || live.ltp),
          change: `${Number(live.changePercent || 0) >= 0 ? '+' : ''}${Number(live.changePercent || 0).toFixed(2)}%`,
          isUp: Number(live.changePercent || 0) >= 0
        };
      }
      return inst;
    });
  }, [marketStocks]);

  useEffect(() => {
    if (activeEditing) {
      setSymbol(activeEditing.symbol || 'NSE:RELIANCE');
      setCustomSymbol('');
      setStrategy(activeEditing.algoStrategy || 'EMA 9/21 Trend Scalper');
      setMode(activeEditing.mode === 'PAPER' ? 'SANDBOX' : (activeEditing.mode || 'LIVE'));
      setLots(activeEditing.lots || 1);
      setTargetPts(activeEditing.targetPts || 60);
      setSlPts(activeEditing.slPts || 25);
      setTrailingSl(activeEditing.trailingSl !== false);
      setAutoSquareOff(activeEditing.autoSquareOff || '15:15');
    } else {
      setSymbol('NSE:RELIANCE');
      setCustomSymbol('');
      setStrategy('EMA 9/21 Trend Scalper');
      setMode('LIVE');
      setLots(1);
      setTargetPts(60);
      setSlPts(25);
      setTrailingSl(true);
      setAutoSquareOff('15:15');
    }
  }, [activeEditing, isOpen]);

  const handleStrategyChange = (stName) => {
    setStrategy(stName);
    const tmpl = STRATEGY_TEMPLATES.find(t => t.id === stName);
    if (tmpl) {
      setTargetPts(tmpl.target);
      setSlPts(tmpl.sl);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const rawSym = (customSymbol.trim() || symbol || 'NSE:RELIANCE').toUpperCase();
    const finalSym = rawSym.includes(':') ? rawSym : `NSE:${rawSym}`;
    const cleanSym = finalSym.split(':')[1] || finalSym;
    const liveMatch = Array.isArray(marketStocks)
      ? marketStocks.find(s => String(s.symbol || '').toUpperCase() === cleanSym)
      : null;
    const inst = instrumentList.find(i => i.symbol === finalSym) || { ltp: 1250, lotSize: 50 };
    const resolvedLtp = (liveMatch && Number(liveMatch.price || liveMatch.ltp)) || activeEditing?.ltp || inst.ltp;

    const newAlgo = {
      id: activeEditing?.id || ('WL-' + Math.floor(100 + Math.random() * 900)),
      symbol: finalSym,
      ltp: resolvedLtp,
      change: inst.change || activeEditing?.change || '+0.00%',
      isUp: inst.isUp !== undefined ? inst.isUp : (activeEditing?.isUp !== undefined ? activeEditing.isUp : true),
      high: activeEditing?.high || Number((resolvedLtp * 1.012).toFixed(2)),
      low: activeEditing?.low || Number((resolvedLtp * 0.988).toFixed(2)),
      algoStrategy: strategy,
      algoActive: activeEditing ? activeEditing.algoActive : true,
      mode,
      status: activeEditing?.status || 'WAITING_TRIGGER',
      lots: Number(lots) || 1,
      qty: (Number(lots) || 1) * (inst.lotSize || 50),
      targetPts: Number(targetPts) || 60,
      slPts: Number(slPts) || 25,
      trailingSl,
      autoSquareOff,
      realizedPnl: activeEditing?.realizedPnl || 0
    };

    onDeploy(newAlgo);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100020,
      background: 'rgba(3, 7, 18, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      <div style={{
        background: isLight ? 'var(--bg-panel, #ffffff)' : '#0d1322',
        border: isLight ? '1px solid var(--border-color, #e2e8f0)' : '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '520px',
        color: isLight ? 'var(--text-primary, #0f172a)' : '#f8fafc',
        boxShadow: isLight ? '0 25px 60px -15px rgba(0,0,0,0.15)' : '0 25px 60px -15px rgba(0,0,0,0.8)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: isLight ? 'var(--bg-card, #f8fafc)' : '#111827',
          borderBottom: isLight ? '1px solid var(--border-color, #e2e8f0)' : '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Zap size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: isLight ? 'var(--text-primary, #0f172a)' : '#fff' }}>
                {activeEditing ? 'Configure Algo Parameters' : 'Deploy New Algo Strategy'}
              </div>
              <div style={{ fontSize: '11px', color: isLight ? '#64748b' : '#94a3b8' }}>
                Angel One SmartAPI Execution Engine • Sub-15ms Route
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: isLight ? '#64748b' : '#94a3b8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Select Instrument */}
          <div>
            <label style={{ fontSize: '12px', color: isLight ? '#475569' : '#94a3b8', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
              SELECT INSTRUMENT OR ENTER CUSTOM NSE SYMBOL
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '8px' }}>
              <select
                value={symbol}
                onChange={e => {
                  setSymbol(e.target.value);
                  setCustomSymbol('');
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: isLight ? 'var(--bg-input, #f8fafc)' : '#121826',
                  border: isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid #1e293b',
                  borderRadius: '8px',
                  color: isLight ? 'var(--text-primary, #0f172a)' : '#fff',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
              >
                {instrumentList.map(i => (
                  <option key={i.symbol} value={i.symbol} style={{ background: isLight ? '#ffffff' : '#0f172a', color: isLight ? '#0f172a' : '#fff' }}>
                    {i.symbol} (₹{Number(i.ltp).toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Or custom (e.g. WIPRO)"
                value={customSymbol}
                onChange={e => setCustomSymbol(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: isLight ? 'var(--bg-input, #f8fafc)' : '#121826',
                  border: isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid #1e293b',
                  borderRadius: '8px',
                  color: isLight ? '#0284c7' : '#38bdf8',
                  fontSize: '12.5px',
                  fontWeight: '700'
                }}
              />
            </div>
          </div>

          {/* Strategy Template */}
          <div>
            <label style={{ fontSize: '12px', color: isLight ? '#475569' : '#94a3b8', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
              ALGORITHM STRATEGY
            </label>
            <select
              value={strategy}
              onChange={e => handleStrategyChange(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: isLight ? 'var(--bg-input, #f8fafc)' : '#121826',
                border: isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid #1e293b',
                borderRadius: '8px',
                color: isLight ? '#0284c7' : '#38bdf8',
                fontSize: '13px',
                fontWeight: '700'
              }}
            >
              {STRATEGY_TEMPLATES.map(t => (
                <option key={t.id} value={t.id} style={{ background: isLight ? '#ffffff' : '#0f172a', color: isLight ? '#0f172a' : '#fff' }}>
                  {t.name}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '11px', color: isLight ? '#64748b' : '#64748b', marginTop: '4px' }}>
              {STRATEGY_TEMPLATES.find(t => t.id === strategy)?.desc}
            </div>
          </div>

          {/* Execution Mode (Paper vs Live) */}
          <div>
            <label style={{ fontSize: '12px', color: isLight ? '#475569' : '#94a3b8', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
              EXECUTION ENGINE MODE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setMode('LIVE')}
                style={{
                  padding: '10px',
                  background: mode === 'LIVE' ? (isLight ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.15)') : (isLight ? '#f1f5f9' : '#121826'),
                  border: `1px solid ${mode === 'LIVE' ? '#22c55e' : (isLight ? 'var(--border-color, #cbd5e1)' : '#1e293b')}`,
                  borderRadius: '8px',
                  color: mode === 'LIVE' ? (isLight ? '#16a34a' : '#22c55e') : (isLight ? '#64748b' : '#94a3b8'),
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                ⚡ Live Multi-Broker (Real Demat)
              </button>
              {/* Execution Mode (Sandbox vs Live) */}
              <button
                type="button"
                onClick={() => setMode('SANDBOX')}
                style={{
                  padding: '10px',
                  background: mode === 'SANDBOX' ? (isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(56, 189, 248, 0.15)') : (isLight ? '#f1f5f9' : '#121826'),
                  border: `1px solid ${mode === 'SANDBOX' ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? 'var(--border-color, #cbd5e1)' : '#1e293b')}`,
                  borderRadius: '8px',
                  color: mode === 'SANDBOX' ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? '#64748b' : '#94a3b8'),
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                🧪 Sandbox Simulator (Risk-Free)
              </button>
            </div>
          </div>

          {/* Risk Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: isLight ? '#64748b' : '#64748b', fontWeight: '700' }}>LOTS / QTY</label>
              <input
                type="number"
                min="1"
                max="50"
                value={lots}
                onChange={e => setLots(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: isLight ? 'var(--bg-input, #f8fafc)' : '#121826', border: isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid #1e293b', borderRadius: '6px', color: isLight ? 'var(--text-primary, #0f172a)' : '#fff', fontSize: '13px', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: isLight ? '#64748b' : '#64748b', fontWeight: '700' }}>TARGET (PTS)</label>
              <input
                type="number"
                value={targetPts}
                onChange={e => setTargetPts(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: isLight ? 'var(--bg-input, #f8fafc)' : '#121826', border: isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid #1e293b', borderRadius: '6px', color: isLight ? '#16a34a' : '#22c55e', fontSize: '13px', fontWeight: '700', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: isLight ? '#64748b' : '#64748b', fontWeight: '700' }}>STOP LOSS (PTS)</label>
              <input
                type="number"
                value={slPts}
                onChange={e => setSlPts(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: isLight ? 'var(--bg-input, #f8fafc)' : '#121826', border: isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid #1e293b', borderRadius: '6px', color: isLight ? '#dc2626' : '#ef4444', fontSize: '13px', fontWeight: '700', marginTop: '4px' }}
              />
            </div>
          </div>

          {/* Trailing SL & Auto Square Off */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: isLight ? 'var(--bg-card, #f8fafc)' : '#121826', borderRadius: '8px', border: isLight ? '1px solid var(--border-color, #e2e8f0)' : '1px solid #1e293b' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: isLight ? 'var(--text-primary, #0f172a)' : '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={trailingSl}
                onChange={e => setTrailingSl(e.target.checked)}
                style={{ accentColor: '#22c55e', width: '16px', height: '16px' }}
              />
              Enable Trailing Stop Loss
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: isLight ? '#64748b' : '#94a3b8' }}>
              Auto Exit:
              <input
                type="text"
                value={autoSquareOff}
                onChange={e => setAutoSquareOff(e.target.value)}
                style={{ width: '56px', padding: '3px 6px', background: isLight ? '#ffffff' : '#090d16', border: isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid #1e293b', borderRadius: '4px', color: isLight ? '#0284c7' : '#38bdf8', fontSize: '11px', textAlign: 'center', fontWeight: '700' }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '12px', background: isLight ? 'rgba(0, 0, 0, 0.05)' : '#1e293b', border: isLight ? '1px solid var(--border-color, #cbd5e1)' : 'none', color: isLight ? '#475569' : '#cbd5e1', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 2,
                padding: '12px',
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '13.5px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(2, 132, 199, 0.35)'
              }}
            >
              {activeEditing ? 'Save Strategy Settings' : 'Deploy to Algo Watchlist ⚡'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
