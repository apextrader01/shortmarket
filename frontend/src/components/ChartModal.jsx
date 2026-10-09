import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { X, ArrowLeft, RotateCcw, BarChart2, Info } from 'lucide-react';
import ChartWidget from './ChartWidget';

export default function ChartModal() {
  const chartModalSymbol = useStore(state => state.chartModalSymbol);
  const setChartModalSymbol = useStore(state => state.setChartModalSymbol);
  const prices = useStore(state => state.prices);
  const fetchBatchPrices = useStore(state => state.fetchBatchPrices);

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
        backgroundColor: '#0b1120',
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
        backgroundColor: 'rgba(11, 17, 32, 0.92)',
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
        background: '#0b1120',
        overflow: 'hidden'
      } : {
        background: '#111827',
        borderRadius: '14px',
        width: '95%',
        maxWidth: '1280px',
        height: '92vh',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden'
      }}>
        {/* Unified Top Header Bar */}
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center', 
          padding: isMobile ? '8px 12px' : '12px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: '#0f172a',
          flexShrink: 0,
          gap: '10px'
        }}>
          {/* Left: Close/Back + Stock Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', minWidth: 0 }}>
            <button 
              onClick={() => setChartModalSymbol(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                color: '#94a3b8',
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
                <span style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: '800', color: '#f8fafc', whiteSpace: 'nowrap' }}>
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
                  <span style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '800', color: isUp ? '#34d399' : '#f87171' }}>
                    ₹{Number(ltp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {pct !== null && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: isUp ? '#34d399' : '#f87171',
                      background: isUp ? 'rgba(52, 211, 153, 0.12)' : 'rgba(248, 113, 113, 0.12)',
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
                  background: isLandscape ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  border: isLandscape ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: isLandscape ? '#38bdf8' : '#cbd5e1',
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
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setActiveView('chart')}
                style={{
                  background: activeView === 'chart' ? '#2563eb' : 'transparent',
                  color: activeView === 'chart' ? '#fff' : '#94a3b8',
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
                  color: activeView === 'details' ? '#fff' : '#94a3b8',
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
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', marginLeft: '4px' }}
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


