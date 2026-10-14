import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { X, ArrowLeft, RotateCcw, BarChart2, Info } from 'lucide-react';
import ChartWidget from './ChartWidget';

export default function ChartModal() {
  const chartModalSymbol = useStore(state => state.chartModalSymbol);
  const setChartModalSymbol = useStore(state => state.setChartModalSymbol);
  const prices = useStore(state => state.prices);
  const fetchBatchPrices = useStore(state => state.fetchBatchPrices);
  const theme = useStore(state => state.theme);
  const isLight = theme === 'light';

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [isLandscape, setIsLandscape] = useState(false);
  const [activeView, setActiveView] = useState('chart'); // 'chart' | 'details'

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (chartModalSymbol && typeof fetchBatchPrices === 'function') {
      const clean = chartModalSymbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
      const base = clean.replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ|INDEX)$/i, '');
      fetchBatchPrices([chartModalSymbol, clean, base, `NSE:${base}-EQ`], true);
    }
  }, [chartModalSymbol, fetchBatchPrices]);

  if (!chartModalSymbol) return null;

  const toggleLandscape = () => {
    setIsLandscape(prev => !prev);
    try {
      if (!isLandscape && window.screen?.orientation?.lock) {
        window.screen.orientation.lock('landscape').catch(() => {});
      } else if (isLandscape && window.screen?.orientation?.unlock) {
        window.screen.orientation.unlock();
      }
    } catch (_) {}
  };

  const cleanSym = chartModalSymbol.replace(/^(NSE:|BSE:|MCX:)/i, '').split('-')[0];
  const exchange = chartModalSymbol.startsWith('MCX:') ? 'MCX' : chartModalSymbol.startsWith('BSE:') ? 'BSE' : 'NSE';
  
  const rawPriceObj = prices[chartModalSymbol] || 
    prices[chartModalSymbol.replace(/^(NSE:|BSE:|MCX:)/i, '')] || 
    prices[cleanSym] || 
    prices[`NSE:${cleanSym}-EQ`];
  
  const ltp = rawPriceObj?.ltp;
  const isUp = (rawPriceObj?.pct ?? 0) >= 0;
  const pct = rawPriceObj?.pct != null ? Number(rawPriceObj.pct).toFixed(2) : null;
  const change = rawPriceObj?.change != null ? Number(rawPriceObj.change).toFixed(2) : null;
  const profitColor = isLight ? '#16a34a' : '#34d399';
  const lossColor = isLight ? '#dc2626' : '#f87171';

  return (
    <div 
      style={isMobile ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: isLandscape ? '100vh' : '100vw',
        height: isLandscape ? '100vw' : '100dvh',
        transform: isLandscape ? 'rotate(90deg) translateY(-100%)' : 'none',
        transformOrigin: 'top left',
        backgroundColor: isLight ? '#ffffff' : '#0b1120',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: 0,
        margin: 0
      } : {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(11, 17, 32, 0.92)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '16px'
      }}
    >
      <div style={isMobile ? {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: isLight ? '#ffffff' : '#0b1120',
        overflow: 'hidden'
      } : {
        background: isLight ? '#ffffff' : '#111827',
        borderRadius: '14px',
        width: '95%',
        maxWidth: '1280px',
        height: '92vh',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: isLight ? '0 25px 50px -12px rgba(0, 0, 0, 0.2)' : '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden'
      }}>
        {/* Unified Top Header Bar */}
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center', 
          padding: isMobile ? '8px 12px' : '12px 20px',
          borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
          background: isLight ? '#ffffff' : '#0f172a',
          flexShrink: 0,
          gap: '10px'
        }}>
          {/* Left: Close/Back + Stock Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', minWidth: 0 }}>
            <button 
              onClick={() => setChartModalSymbol(null)}
              style={{
                background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                color: isLight ? '#475569' : '#94a3b8',
                borderRadius: '8px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
              title="Close chart"
            >
              {isMobile ? <ArrowLeft size={18} /> : <X size={20} />}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: '800', color: isLight ? '#0f172a' : '#f8fafc', whiteSpace: 'nowrap' }}>
                  {cleanSym}
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  background: exchange === 'BSE' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                  color: exchange === 'BSE' ? '#d8b4fe' : '#93c5fd',
                  border: `1px solid ${exchange === 'BSE' ? 'rgba(168, 85, 247, 0.35)' : 'rgba(59, 130, 246, 0.35)'}`
                }}>
                  {exchange}
                </span>
              </div>

              {ltp != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '800', color: isUp ? profitColor : lossColor }}>
                    ₹{Number(ltp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {pct !== null && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: isUp ? profitColor : lossColor,
                      background: isUp ? (isLight ? 'rgba(22, 163, 74, 0.12)' : 'rgba(52, 211, 153, 0.12)') : (isLight ? 'rgba(220, 38, 38, 0.12)' : 'rgba(248, 113, 113, 0.12)'),
                      padding: '1px 5px',
                      borderRadius: '4px'
                    }}>
                      {isUp ? '+' : ''}{change ? `${change} ` : ''}({isUp ? '+' : ''}{pct}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions (Landscape Rotate, View Toggle, Close) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Rotate to Landscape Button on Mobile */}
            {isMobile && (
              <button
                onClick={toggleLandscape}
                style={{
                  background: isLandscape ? (isLight ? 'rgba(14, 165, 233, 0.15)' : 'rgba(56, 189, 248, 0.2)') : (isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.06)'),
                  border: isLandscape ? (isLight ? '1px solid #0284c7' : '1px solid #38bdf8') : (isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.1)'),
                  color: isLandscape ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? '#475569' : '#cbd5e1'),
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
                title={isLandscape ? "Switch to Portrait" : "Switch to Landscape"}
              >
                <RotateCcw size={13} />
                <span>{isLandscape ? "Portrait" : "Rotate"}</span>
              </button>
            )}

            {/* View Switcher: Chart vs Details */}
            <div style={{ display: 'flex', background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '2px', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setActiveView('chart')}
                style={{
                  background: activeView === 'chart' ? '#2563eb' : 'transparent',
                  color: activeView === 'chart' ? '#fff' : (isLight ? '#64748b' : '#94a3b8'),
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <BarChart2 size={12} />
                <span>Chart</span>
              </button>
              <button
                onClick={() => setActiveView('details')}
                style={{
                  background: activeView === 'details' ? '#2563eb' : 'transparent',
                  color: activeView === 'details' ? '#fff' : (isLight ? '#64748b' : '#94a3b8'),
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <Info size={12} />
                <span>Details</span>
              </button>
            </div>

            {/* Close Button on Desktop */}
            {!isMobile && (
              <button 
                onClick={() => setChartModalSymbol(null)}
                style={{ background: 'none', border: 'none', color: isLight ? '#64748b' : '#94a3b8', cursor: 'pointer', padding: '4px', marginLeft: '4px' }}
                title="Close"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
        
        {/* Body Container */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ChartWidgetWrapper 
            symbol={chartModalSymbol} 
            isModal={true}
            isMobile={isMobile}
            isLandscape={isLandscape}
            activeView={activeView}
            onClose={() => setChartModalSymbol(null)}
          />
        </div>
      </div>
    </div>
  );
}

function ChartWidgetWrapper({ symbol, isModal, isMobile, isLandscape, activeView, onClose }) {
  const setSelectedSymbol = useStore(state => state.setSelectedSymbol);
  const selectedSymbol = useStore(state => state.selectedSymbol);
  const [originalSymbol] = React.useState(selectedSymbol);

  React.useEffect(() => {
    setSelectedSymbol(symbol);
    return () => setSelectedSymbol(originalSymbol);
  }, [symbol, originalSymbol, setSelectedSymbol]);

  if (selectedSymbol !== symbol) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', padding: '40px' }}>
        Loading Chart for {symbol}...
      </div>
    );
  }

  return (
    <ChartWidget 
      isModal={isModal} 
      isMobile={isMobile} 
      isLandscape={isLandscape} 
      activeView={activeView} 
      onClose={onClose} 
    />
  );
}


