import React, { useState, useEffect } from 'react';
import { X, Zap, Cpu, ShieldCheck, Play, Sliders, CheckCircle2 } from 'lucide-react';

const POPULAR_INSTRUMENTS = [
  { symbol: 'NSE:NIFTY24OCTFUT', name: 'Nifty 50 Futures', type: 'INDEX_FUT', ltp: 25014.60, lotSize: 75 },
  { symbol: 'NSE:BANKNIFTY51500CE', name: 'BankNifty 51500 Call', type: 'OPT_CE', ltp: 342.50, lotSize: 15 },
  { symbol: 'NSE:FINNIFTY23800PE', name: 'FinNifty 23800 Put', type: 'OPT_PE', ltp: 112.80, lotSize: 65 },
  { symbol: 'NSE:SENSEX74000CE', name: 'Sensex 74000 Call', type: 'BSE_OPT', ltp: 215.00, lotSize: 10 },
  { symbol: 'NSE:RELIANCE', name: 'Reliance Industries', type: 'EQUITY', ltp: 2985.40, lotSize: 1 },
  { symbol: 'NSE:HDFCBANK', name: 'HDFC Bank Ltd', type: 'EQUITY', ltp: 1682.10, lotSize: 1 },
  { symbol: 'MCX:GOLD26OCTFUT', name: 'MCX Gold Futures', type: 'COMMODITY', ltp: 76450.00, lotSize: 1 }
];

const STRATEGY_TEMPLATES = [
  { id: 'EMA 9/21 Trend Scalper', name: 'EMA 9/21 Trend Scalper', desc: 'Fast momentum scalper on 3-min chart with ATR trailing filter', target: 60, sl: 25 },
  { id: '9:20 AM Short Straddle', name: '9:20 AM Short Straddle', desc: 'Sells ATM CE + PE with 25% SL on both legs at market open', target: 110, sl: 55 },
  { id: 'Supertrend 7/3 Breakout', name: 'Supertrend 7/3 Breakout', desc: 'Trend continuation with adaptive dynamic volatility bands', target: 80, sl: 35 },
  { id: 'VWAP Mean Reversion', name: 'VWAP Mean Reversion', desc: 'Institutional volume weighted average price pullback engine', target: 25, sl: 12 },
  { id: '15-Min ORB Breakout', name: '15-Min ORB Breakout', desc: 'Opening range breakout of high/low with volume confirmation', target: 50, sl: 20 },
  { id: 'Delta-Neutral Seller', name: 'Delta-Neutral Seller', desc: 'Theta decay harvester with automatic Greek adjustments', target: 150, sl: 60 }
];

export default function DeployAlgoModal({ isOpen, onClose, onDeploy, editingItem = null }) {
  const [symbol, setSymbol] = useState('NSE:NIFTY24OCTFUT');
  const [strategy, setStrategy] = useState('EMA 9/21 Trend Scalper');
  const [mode, setMode] = useState('LIVE');
  const [lots, setLots] = useState(1);
  const [targetPts, setTargetPts] = useState(60);
  const [slPts, setSlPts] = useState(25);
  const [trailingSl, setTrailingSl] = useState(true);
  const [autoSquareOff, setAutoSquareOff] = useState('15:15');

  useEffect(() => {
    if (editingItem) {
      setSymbol(editingItem.symbol || 'NSE:NIFTY24OCTFUT');
      setStrategy(editingItem.algoStrategy || 'EMA 9/21 Trend Scalper');
      setMode(editingItem.mode || 'LIVE');
      setLots(editingItem.lots || 1);
      setTargetPts(editingItem.targetPts || 60);
      setSlPts(editingItem.slPts || 25);
      setTrailingSl(editingItem.trailingSl !== false);
      setAutoSquareOff(editingItem.autoSquareOff || '15:15');
    } else {
      setSymbol('NSE:NIFTY24OCTFUT');
      setStrategy('EMA 9/21 Trend Scalper');
      setMode('LIVE');
      setLots(1);
      setTargetPts(60);
      setSlPts(25);
      setTrailingSl(true);
      setAutoSquareOff('15:15');
    }
  }, [editingItem, isOpen]);

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
    const inst = POPULAR_INSTRUMENTS.find(i => i.symbol === symbol) || { ltp: 25000, lotSize: 50 };
    const newAlgo = {
      id: editingItem?.id || ('WL-' + Math.floor(10 + Math.random() * 90)),
      symbol,
      ltp: inst.ltp,
      change: '+1.15%',
      isUp: true,
      high: inst.ltp * 1.01,
      low: inst.ltp * 0.99,
      algoStrategy: strategy,
      algoActive: true,
      mode,
      status: mode === 'LIVE' ? 'IN_POSITION_LONG' : 'WAITING_TRIGGER',
      lots: Number(lots) || 1,
      qty: (Number(lots) || 1) * (inst.lotSize || 50),
      targetPts: Number(targetPts) || 50,
      slPts: Number(slPts) || 25,
      trailingSl,
      autoSquareOff,
      realizedPnl: editingItem?.realizedPnl || 0
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
        background: '#0d1322',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '520px',
        color: '#f8fafc',
        boxShadow: '0 25px 60px -15px rgba(0,0,0,0.8)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: '#111827',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
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
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff' }}>
                {editingItem ? 'Configure Algo Parameters' : 'Deploy New Algo Strategy'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Multi-Broker Execution Engine • Sub-15ms Route
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Select Instrument */}
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
              SELECT INSTRUMENT / SYMBOL
            </label>
            <select
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#121826',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              {POPULAR_INSTRUMENTS.map(i => (
                <option key={i.symbol} value={i.symbol} style={{ background: '#0f172a', color: '#fff' }}>
                  {i.symbol} — {i.name} (₹{i.ltp})
                </option>
              ))}
            </select>
          </div>

          {/* Strategy Template */}
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
              ALGORITHM STRATEGY
            </label>
            <select
              value={strategy}
              onChange={e => handleStrategyChange(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#121826',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                color: '#38bdf8',
                fontSize: '13px',
                fontWeight: '700'
              }}
            >
              {STRATEGY_TEMPLATES.map(t => (
                <option key={t.id} value={t.id} style={{ background: '#0f172a', color: '#fff' }}>
                  {t.name}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              {STRATEGY_TEMPLATES.find(t => t.id === strategy)?.desc}
            </div>
          </div>

          {/* Execution Mode (Paper vs Live) */}
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
              EXECUTION ENGINE MODE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setMode('LIVE')}
                style={{
                  padding: '10px',
                  background: mode === 'LIVE' ? 'rgba(34, 197, 94, 0.15)' : '#121826',
                  border: `1px solid ${mode === 'LIVE' ? '#22c55e' : '#1e293b'}`,
                  borderRadius: '8px',
                  color: mode === 'LIVE' ? '#22c55e' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                ⚡ Live Multi-Broker (Real Demat)
              </button>
              <button
                type="button"
                onClick={() => setMode('PAPER')}
                style={{
                  padding: '10px',
                  background: mode === 'PAPER' ? 'rgba(56, 189, 248, 0.15)' : '#121826',
                  border: `1px solid ${mode === 'PAPER' ? '#38bdf8' : '#1e293b'}`,
                  borderRadius: '8px',
                  color: mode === 'PAPER' ? '#38bdf8' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                📝 Paper Simulator (Risk-Free)
              </button>
            </div>
          </div>

          {/* Risk Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>LOTS / QTY</label>
              <input
                type="number"
                min="1"
                max="50"
                value={lots}
                onChange={e => setLots(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: '#121826', border: '1px solid #1e293b', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>TARGET (PTS)</label>
              <input
                type="number"
                value={targetPts}
                onChange={e => setTargetPts(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: '#121826', border: '1px solid #1e293b', borderRadius: '6px', color: '#22c55e', fontSize: '13px', fontWeight: '700', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>STOP LOSS (PTS)</label>
              <input
                type="number"
                value={slPts}
                onChange={e => setSlPts(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: '#121826', border: '1px solid #1e293b', borderRadius: '6px', color: '#ef4444', fontSize: '13px', fontWeight: '700', marginTop: '4px' }}
              />
            </div>
          </div>

          {/* Trailing SL & Auto Square Off */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: '#121826', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={trailingSl}
                onChange={e => setTrailingSl(e.target.checked)}
                style={{ accentColor: '#22c55e', width: '16px', height: '16px' }}
              />
              Enable Trailing Stop Loss
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#94a3b8' }}>
              Auto Exit:
              <input
                type="text"
                value={autoSquareOff}
                onChange={e => setAutoSquareOff(e.target.value)}
                style={{ width: '56px', padding: '3px 6px', background: '#090d16', border: '1px solid #1e293b', borderRadius: '4px', color: '#38bdf8', fontSize: '11px', textAlign: 'center', fontWeight: '700' }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '12px', background: '#1e293b', border: 'none', color: '#cbd5e1', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
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
              {editingItem ? 'Save Strategy Settings' : 'Deploy to Algo Watchlist ⚡'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
