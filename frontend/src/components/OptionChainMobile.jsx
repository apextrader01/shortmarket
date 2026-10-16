import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { calculateIV, calculateGreeks } from '../utils/blackScholes';
import { formatInstrument } from '../utils/symbolFormatter';
import { getInstantLotsize } from '../utils/lotsizeHelper';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart2, 
  Layers, 
  Bell, 
  AlignLeft, 
  X, 
  ShoppingBag,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

const ALLOWED_INDEX_SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 'BANKEX'];

const formatOI = (oi) => {
  if (!oi || isNaN(Number(oi)) || Number(oi) === 0) return '-';
  const n = Number(oi);
  if (n >= 10000000) return (n / 10000000).toFixed(2) + 'Cr';
  if (n >= 100000) return (n / 100000).toFixed(2) + 'L';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString('en-IN');
};

export default function OptionChainMobile({
  symbol,
  setSymbol,
  expiry,
  setExpiry,
  expiries,
  strikes,
  chain,
  spotPrice,
  spotPct,
  futPrice,
  futPct,
  synthFutPrice,
  vixPrice,
  vixChange,
  atmStrike,
  basePrice,
  pricingPrice,
  maxPain,
  pcr,
  maxCallOI = 1,
  maxPutOI = 1,
  T,
  r,
  isIndex,
  handleTrade,
  oneClickMode,
  oneClickMultiplier,
  setAlertModalSymbol,
  setChartModalSymbol,
  openMarketDepthModal,
  addToBasket
}) {
  const [viewMode, setViewMode] = useState('LTP'); // 'LTP' | 'OI' | 'GREEKS'
  const [selectedContract, setSelectedContract] = useState(null); // Option selected for Quick Action Sheet
  const mobileListRef = useRef(null);
  const atmRowRef = useRef(null);

  const prices = useStore(state => state.prices);

  // Auto-scroll to ATM strike when loaded or expiry changes
  useEffect(() => {
    if (atmRowRef.current && mobileListRef.current) {
      const timer = setTimeout(() => {
        if (atmRowRef.current && mobileListRef.current) {
          const container = mobileListRef.current;
          const row = atmRowRef.current;
          const containerRect = container.getBoundingClientRect();
          const rowRect = row.getBoundingClientRect();
          container.scrollBy({
            top: (rowRect.top - containerRect.top) - (containerRect.height / 2) + (rowRect.height / 2),
            behavior: 'smooth'
          });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [atmStrike, expiry, symbol]);

  const handleContractTap = (opt, type, strike, ltp, change, pct, iv, greeks, oi, vol) => {
    if (!opt) return;
    const cleanSym = opt.symbol;
    setSelectedContract({
      option: opt,
      type,
      strike,
      symbol: cleanSym,
      ltp,
      change,
      pct,
      iv,
      greeks,
      oi,
      vol,
      lotsize: opt.lotsize ? parseInt(opt.lotsize) : getInstantLotsize(cleanSym) || 1
    });
  };

  const modelPrice = (pricingPrice && pricingPrice > 0) ? pricingPrice : (basePrice > 0 ? basePrice : 0);
  const referencePrice = modelPrice > 0 ? modelPrice : basePrice;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main, #0b0e14)', color: 'var(--text-primary, #f8fafc)', overflow: 'hidden' }}>
      
      {/* ⚡ Top Pinned Mobile Header: Segmented Index Selector */}
      <div 
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: '6px',
          padding: '8px 12px 6px',
          background: 'var(--bg-panel, #131722)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}
        className="scrollbar-hide"
      >
        {ALLOWED_INDEX_SYMBOLS.map((idxSym) => {
          const isSelected = symbol === idxSym;
          return (
            <button
              key={idxSym}
              type="button"
              onClick={() => setSymbol(idxSym)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: isSelected ? '700' : '500',
                color: isSelected ? '#ffffff' : 'var(--text-secondary, #94a3b8)',
                background: isSelected ? 'var(--color-blue, #2563eb)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${isSelected ? 'var(--color-blue, #2563eb)' : 'rgba(255, 255, 255, 0.08)'}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              {idxSym}
            </button>
          );
        })}
      </div>

      {/* ⚡ Compact Market Pulse Card */}
      <div style={{
        padding: '10px 14px 8px',
        background: 'var(--bg-panel, #131722)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary, #94a3b8)', letterSpacing: '0.2px' }}>
              {symbol} SPOT
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
              <span style={{ fontSize: '16px', fontWeight: '800', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                {spotPrice > 0 ? spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
              </span>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: '700', 
                color: spotPct >= 0 ? 'var(--color-green-light, #10b981)' : 'var(--color-red-light, #ef4444)',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {spotPct > 0 ? '+' : ''}{spotPct.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Expiry Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)' }}>EXPIRY</span>
            <div style={{ position: 'relative' }}>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '4px 22px 4px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  outline: 'none',
                  appearance: 'none',
                  cursor: 'pointer'
                }}
              >
                {expiries.map(exp => (
                  <option key={exp} value={exp} style={{ background: '#1e293b', color: '#fff' }}>{exp}</option>
                ))}
              </select>
              <ChevronDown size={11} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
            </div>
          </div>
        </div>

        {/* Pulse Badges (Futures, Synth Fut, VIX, PCR, Max Pain) */}
        <div style={{ display: 'flex', overflowX: 'auto', gap: '6px', paddingBottom: '2px' }} className="scrollbar-hide">
          {futPrice > 0 && (
            <div style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '10px', whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--text-secondary)' }}>FUT: </span>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{futPrice.toFixed(2)}</strong>
            </div>
          )}
          {synthFutPrice > 0 && (
            <div style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '10px', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#93c5fd' }}>SYNTH: </span>
              <strong style={{ color: '#60a5fa', fontVariantNumeric: 'tabular-nums' }}>{synthFutPrice.toFixed(2)}</strong>
            </div>
          )}
          {vixPrice > 0 && (
            <div style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '10px', whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--text-secondary)' }}>VIX: </span>
              <strong style={{ fontVariantNumeric: 'tabular-nums', color: vixChange >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>{vixPrice.toFixed(2)}</strong>
            </div>
          )}
          {pcr && (
            <div style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '10px', whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--text-secondary)' }}>PCR: </span>
              <strong style={{ color: Number(pcr) >= 1 ? 'var(--color-green-light)' : 'var(--color-red-light)', fontVariantNumeric: 'tabular-nums' }}>{pcr}</strong>
            </div>
          )}
          {maxPain > 0 && (
            <div style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '10px', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#fbbf24' }}>MAX PAIN: </span>
              <strong style={{ color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>{maxPain}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ⚡ View Mode Segmented Controls (LTP vs OI vs Greeks) */}
      <div style={{
        display: 'flex',
        padding: '6px 12px',
        background: 'var(--bg-panel, #131722)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          {[
            { id: 'LTP', label: 'Price & %' },
            { id: 'OI', label: 'OI & Volume' },
            { id: 'GREEKS', label: 'Greeks (Δ, θ, IV)' }
          ].map(m => {
            const active = viewMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setViewMode(m.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: active ? '700' : '500',
                  color: active ? '#ffffff' : 'var(--text-secondary)',
                  background: active ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                  border: active ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
                  cursor: 'pointer'
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>
          Tap row to trade
        </div>
      </div>

      {/* ⚡ Sticky Column Header (CALLS | STRIKE | PUTS) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 76px 1fr',
        background: '#0d1117',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '7px 0',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.3px',
        textAlign: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 5
      }}>
        <div style={{ color: 'var(--color-green-light, #10b981)', paddingLeft: '8px', textAlign: 'left' }}>
          CALLS (CE)
        </div>
        <div style={{ color: 'var(--text-primary)', borderLeft: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          STRIKE
        </div>
        <div style={{ color: 'var(--color-red-light, #ef4444)', paddingRight: '8px', textAlign: 'right' }}>
          PUTS (PE)
        </div>
      </div>

      {/* ⚡ Scrollable Straddle List */}
      <div 
        ref={mobileListRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {strikes.map((strike) => {
          const call = chain[strike]?.CE;
          const put = chain[strike]?.PE;
          const isATM = strike === atmStrike;

          const callKey = call?.symbol;
          const putKey = put?.symbol;
          const callPriceData = prices[callKey] || (callKey?.includes(':') ? prices[callKey.split(':')[1]] : null);
          const putPriceData = prices[putKey] || (putKey?.includes(':') ? prices[putKey.split(':')[1]] : null);

          const cLtp = Number(callPriceData?.ltp ?? call?.ltp ?? 0);
          const pLtp = Number(putPriceData?.ltp ?? put?.ltp ?? 0);
          const cPct = Number(callPriceData?.pct ?? call?.pct ?? 0);
          const pPct = Number(putPriceData?.pct ?? put?.pct ?? 0);
          const cChg = Number(callPriceData?.change ?? call?.change ?? 0);
          const pChg = Number(putPriceData?.change ?? put?.change ?? 0);

          const cOi = Number(callPriceData?.oi ?? call?.oi ?? 0);
          const pOi = Number(putPriceData?.oi ?? put?.oi ?? 0);
          const cVol = Number(callPriceData?.volume ?? call?.volume ?? 0);
          const pVol = Number(putPriceData?.volume ?? put?.volume ?? 0);

          // In-The-Money shading (Calls < Spot, Puts > Spot)
          const isCallITM = referencePrice > 0 && strike < referencePrice;
          const isPutITM = referencePrice > 0 && strike > referencePrice;

          // Greeks Calculation
          let cIV = cLtp > 0 ? calculateIV('CE', cLtp, modelPrice, strike, T, r, isIndex) : 0;
          let pIV = pLtp > 0 ? calculateIV('PE', pLtp, modelPrice, strike, T, r, isIndex) : 0;
          if (cIV === 0 && pIV > 0) cIV = pIV;
          if (pIV === 0 && cIV > 0) pIV = cIV;

          const cGreeks = cIV > 0 ? calculateGreeks('CE', modelPrice, strike, T, r, cIV, isIndex) : { delta: 0, theta: 0 };
          const pGreeks = pIV > 0 ? calculateGreeks('PE', modelPrice, strike, T, r, pIV, isIndex) : { delta: 0, theta: 0 };

          // Visual OI bar width
          const cOiWidth = maxCallOI > 0 ? Math.min(100, Math.round((cOi / maxCallOI) * 100)) : 0;
          const pOiWidth = maxPutOI > 0 ? Math.min(100, Math.round((pOi / maxPutOI) * 100)) : 0;

          return (
            <div
              key={strike}
              ref={isATM ? atmRowRef : null}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 76px 1fr',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                minHeight: '48px',
                background: isATM ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                position: 'relative',
                transition: 'background 0.15s ease'
              }}
            >
              {/* Call Cell */}
              <div
                onClick={() => handleContractTap(call, 'CE', strike, cLtp, cChg, cPct, cIV, cGreeks, cOi, cVol)}
                style={{
                  padding: '6px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  background: isCallITM ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                  position: 'relative',
                  cursor: 'pointer',
                  borderRight: '1px solid rgba(255, 255, 255, 0.06)'
                }}
              >
                {/* Visual OI Bar (only in OI mode) */}
                {viewMode === 'OI' && cOiWidth > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: `${cOiWidth}%`,
                      background: 'rgba(239, 68, 68, 0.12)',
                      pointerEvents: 'none'
                    }}
                  />
                )}

                {viewMode === 'LTP' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', color: cChg >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                        {cLtp > 0 ? cLtp.toFixed(2) : '—'}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: cPct >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', fontVariantNumeric: 'tabular-nums', marginTop: '1px' }}>
                      {cPct > 0 ? '+' : ''}{cPct.toFixed(1)}%
                    </div>
                  </>
                )}

                {viewMode === 'OI' && (
                  <>
                    <div style={{ fontSize: '12px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                      OI: {formatOI(cOi)}
                    </div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', marginTop: '1px' }}>
                      Vol: {formatOI(cVol)}
                    </div>
                  </>
                )}

                {viewMode === 'GREEKS' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Δ {cGreeks.delta.toFixed(2)}</span>
                      <span style={{ color: '#fbbf24' }}>IV {cIV > 0 ? (cIV * 100).toFixed(0) + '%' : '—'}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', marginTop: '1px' }}>
                      θ {cGreeks.theta.toFixed(0)}
                    </div>
                  </>
                )}
              </div>

              {/* Center Strike Cell */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isATM ? 'rgba(59, 130, 246, 0.22)' : 'rgba(0, 0, 0, 0.2)',
                  borderLeft: isATM ? '2px solid #3b82f6' : 'none',
                  borderRight: isATM ? '2px solid #3b82f6' : 'none',
                  position: 'relative'
                }}
              >
                <span style={{ 
                  fontSize: '12.5px', 
                  fontWeight: isATM ? '800' : '700', 
                  color: isATM ? '#60a5fa' : 'var(--text-primary)',
                  fontVariantNumeric: 'tabular-nums' 
                }}>
                  {strike}
                </span>
                {isATM && (
                  <span style={{
                    fontSize: '8px',
                    fontWeight: '800',
                    color: '#ffffff',
                    background: '#2563eb',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    letterSpacing: '0.4px',
                    marginTop: '2px'
                  }}>
                    ATM
                  </span>
                )}
              </div>

              {/* Put Cell */}
              <div
                onClick={() => handleContractTap(put, 'PE', strike, pLtp, pChg, pPct, pIV, pGreeks, pOi, pVol)}
                style={{
                  padding: '6px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                  background: isPutITM ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                  position: 'relative',
                  cursor: 'pointer',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.06)'
                }}
              >
                {/* Visual OI Bar (only in OI mode) */}
                {viewMode === 'OI' && pOiWidth > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${pOiWidth}%`,
                      background: 'rgba(16, 185, 129, 0.12)',
                      pointerEvents: 'none'
                    }}
                  />
                )}

                {viewMode === 'LTP' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', color: pChg >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                        {pLtp > 0 ? pLtp.toFixed(2) : '—'}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: pPct >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', fontVariantNumeric: 'tabular-nums', marginTop: '1px' }}>
                      {pPct > 0 ? '+' : ''}{pPct.toFixed(1)}%
                    </div>
                  </>
                )}

                {viewMode === 'OI' && (
                  <>
                    <div style={{ fontSize: '12px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                      OI: {formatOI(pOi)}
                    </div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', marginTop: '1px' }}>
                      Vol: {formatOI(pVol)}
                    </div>
                  </>
                )}

                {viewMode === 'GREEKS' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: '#fbbf24' }}>IV {pIV > 0 ? (pIV * 100).toFixed(0) + '%' : '—'}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>Δ {pGreeks.delta.toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', marginTop: '1px' }}>
                      θ {pGreeks.theta.toFixed(0)}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ⚡ Quick Order Bottom Sheet Modal for Mobile (Fyers & Zerodha Kite Standard) */}
      {selectedContract && (
        <div 
          onClick={() => setSelectedContract(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 3000,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.18s ease-out'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary, #0f172a)',
              borderRadius: '16px 16px 0 0',
              borderTop: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '16px 18px',
              paddingBottom: 'max(14px, calc(14px + env(safe-area-inset-bottom, 0px)))',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.7)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              animation: 'slideUpSheet 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Sheet Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '-4px' }}>
              <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255, 255, 255, 0.2)' }} />
            </div>

            {/* Header: Contract Name, Tag, LTP */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>
                    {symbol} {selectedContract.strike} {selectedContract.type}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: selectedContract.type === 'CE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: selectedContract.type === 'CE' ? '#10b981' : '#ef4444',
                    border: `1px solid ${selectedContract.type === 'CE' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}>
                    {selectedContract.type}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Expiry: {expiry} • Lot: {selectedContract.lotsize}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', fontVariantNumeric: 'tabular-nums', color: selectedContract.change >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                  ₹{selectedContract.ltp > 0 ? selectedContract.ltp.toFixed(2) : '—'}
                </div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: selectedContract.pct >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                  {selectedContract.pct > 0 ? '+' : ''}{selectedContract.pct.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              textAlign: 'center'
            }}>
              <div>
                <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>DELTA</div>
                <div style={{ fontSize: '11.5px', fontWeight: '700', marginTop: '2px' }}>{selectedContract.greeks?.delta?.toFixed(2) || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>THETA</div>
                <div style={{ fontSize: '11.5px', fontWeight: '700', marginTop: '2px' }}>{selectedContract.greeks?.theta?.toFixed(0) || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>IV</div>
                <div style={{ fontSize: '11.5px', fontWeight: '700', marginTop: '2px', color: '#fbbf24' }}>{selectedContract.iv > 0 ? (selectedContract.iv * 100).toFixed(1) + '%' : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>OI</div>
                <div style={{ fontSize: '11.5px', fontWeight: '700', marginTop: '2px' }}>{formatOI(selectedContract.oi)}</div>
              </div>
            </div>

            {/* Auxiliary Shortcuts (Chart, Depth, Alert, Basket) */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  const sym = selectedContract.symbol;
                  setSelectedContract(null);
                  if (setChartModalSymbol) setChartModalSymbol(sym);
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <BarChart2 size={13} color="var(--color-blue)" /> Chart
              </button>
              <button
                type="button"
                onClick={() => {
                  const sym = selectedContract.symbol;
                  setSelectedContract(null);
                  if (openMarketDepthModal) openMarketDepthModal(sym, selectedContract.lotsize);
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <AlignLeft size={13} color="#8b5cf6" /> Depth
              </button>
              <button
                type="button"
                onClick={() => {
                  const sym = selectedContract.symbol;
                  setSelectedContract(null);
                  if (addToBasket) {
                    addToBasket({
                      symbol: sym,
                      side: 'BUY',
                      quantity: 1,
                      lotsize: selectedContract.lotsize,
                      orderType: 'MARKET',
                      price: ''
                    });
                  }
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <ShoppingBag size={13} color="#38bdf8" /> Basket
              </button>
              <button
                type="button"
                onClick={() => {
                  const sym = selectedContract.symbol;
                  setSelectedContract(null);
                  if (setAlertModalSymbol) setAlertModalSymbol(sym);
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <Bell size={13} color="#eab308" /> Alert
              </button>
            </div>

            {/* Instant BUY and SELL Execution Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  const opt = selectedContract.option;
                  const type = selectedContract.type;
                  const iv = selectedContract.iv;
                  setSelectedContract(null);
                  handleTrade(opt, 'BUY', type, iv);
                }}
                style={{
                  flex: 1,
                  padding: '13px',
                  borderRadius: '8px',
                  background: 'var(--color-green, #10b981)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  minHeight: '44px'
                }}
              >
                BUY {selectedContract.strike} {selectedContract.type}
              </button>
              <button
                type="button"
                onClick={() => {
                  const opt = selectedContract.option;
                  const type = selectedContract.type;
                  const iv = selectedContract.iv;
                  setSelectedContract(null);
                  handleTrade(opt, 'SELL', type, iv);
                }}
                style={{
                  flex: 1,
                  padding: '13px',
                  borderRadius: '8px',
                  background: 'var(--color-red, #ef4444)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
                  minHeight: '44px'
                }}
              >
                SELL {selectedContract.strike} {selectedContract.type}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
