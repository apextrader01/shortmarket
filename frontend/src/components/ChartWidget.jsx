import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { useStore } from '../store';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

const TIMEFRAMES = [
  { label: '1M',  value: 'ONE_MINUTE' },
  { label: '3M',  value: 'THREE_MINUTE' },
  { label: '5M',  value: 'FIVE_MINUTE' },
  { label: '10M', value: 'TEN_MINUTE' },
  { label: '15M', value: 'FIFTEEN_MINUTE' },
  { label: '30M', value: 'THIRTY_MINUTE' },
  { label: '1H',  value: 'ONE_HOUR' },
  { label: '1D',  value: 'ONE_DAY' },
];

export default function ChartWidget() {
  const chartContainerRef = useRef(null);
  const chartRef          = useRef(null);
  const candleSeriesRef   = useRef(null);
  const volumeSeriesRef   = useRef(null);
  const liveLineRef       = useRef(null);
  const mountedRef        = useRef(true);

  const [hoveredCandle, setHoveredCandle] = useState(null);

  const {
    selectedSymbol, prices, candleData,
    isLoadingCandles, candleError,
    chartInterval, setChartInterval, loadCandleData,
    openOrderModal
  } = useStore();

  const price   = prices[selectedSymbol];
  const candles = candleData[selectedSymbol] || [];

  // ── Build chart instance ────────────────────────────────────────────────────
  const buildChart = useCallback(() => {
    if (!chartContainerRef.current) return;

    // Tear down existing chart
    if (chartRef.current) {
      try { chartRef.current.remove(); } catch (_) {}
      chartRef.current    = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      liveLineRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#94A3B8',
        fontSize: 11,
        fontFamily: "'Inter', 'Roboto', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#334155', width: 1, style: 1, labelBackgroundColor: '#1E293B' },
        horzLine: { color: '#334155', width: 1, style: 1, labelBackgroundColor: '#1E293B' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.07)',
        scaleMargins: { top: 0.06, bottom: 0.22 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.07)',
        timeVisible: true,
        secondsVisible: false,
      },
      width:  chartContainerRef.current.clientWidth,
      height: 400,
      handleScroll: true,
      handleScale:  true,
    });
    chartRef.current = chart;

    // Candlestick
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    // Volume histogram on separate scale
    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.80, bottom: 0 },
    });

    // Dotted live-price line
    liveLineRef.current = chart.addSeries(LineSeries, {
      color: '#60A5FA', lineWidth: 1, lineStyle: 2,
      priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    });
    ro.observe(chartContainerRef.current);

    // Crosshair hover for OHLC
    chart.subscribeCrosshairMove((param) => {
      if (
        !param.time || 
        param.point.x < 0 || param.point.x > chartContainerRef.current?.clientWidth || 
        param.point.y < 0 || param.point.y > chartContainerRef.current?.clientHeight
      ) {
        setHoveredCandle(null);
      } else {
        const data = param.seriesData.get(candleSeriesRef.current);
        const volData = param.seriesData.get(volumeSeriesRef.current);
        if (data) {
          setHoveredCandle({ ...data, volume: volData?.value });
        }
      }
    });

    return () => { ro.disconnect(); };
  }, []);

  // Rebuild chart when symbol or interval changes
  useEffect(() => {
    mountedRef.current = true;
    const cleanup = buildChart();
    loadCandleData(selectedSymbol, chartInterval);
    return () => {
      mountedRef.current = false;
      if (cleanup) cleanup();
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch (_) {}
        chartRef.current = null;
      }
    };
  }, [selectedSymbol, chartInterval]); // eslint-disable-line

  // Push candle data into chart whenever it arrives
  useEffect(() => {
    if (!mountedRef.current || !candleSeriesRef.current || candles.length === 0) return;

    try {
      candleSeriesRef.current.setData(candles);

      const volData = candles.map(c => ({
        time:  c.time,
        value: c.volume || 0,
        color: c.close >= c.open ? 'rgba(38,166,154,0.45)' : 'rgba(239,83,80,0.45)',
      }));
      volumeSeriesRef.current?.setData(volData);

      const last = candles[candles.length - 1];
      if (last) liveLineRef.current?.setData([{ time: last.time, value: last.close }]);

      chartRef.current?.timeScale().fitContent();
    } catch (_) {}
  }, [candles]); // fires every time candles array reference changes

  // Live tick update
  useEffect(() => {
    if (!mountedRef.current || !price || !liveLineRef.current) return;
    try {
      const t = price.timestamp ? Math.floor(new Date(price.timestamp).getTime() / 1000) : 0;
      if (t > 0) liveLineRef.current.update({ time: t + 19800, value: price.ltp });
    } catch (_) {}
  }, [prices, selectedSymbol]);

  const isUp   = (price?.pct ?? 0) >= 0;
  const pct    = price?.pct    != null ? Number(price.pct).toFixed(2)    : null;
  const change = price?.change != null ? Number(price.change).toFixed(2) : null;
  const tfLabel = TIMEFRAMES.find(t => t.value === chartInterval)?.label ?? chartInterval;

  return (
    <div className="glass-panel" style={{ padding: '16px 20px' }}>

      {/* ── Row 1: symbol + price + change ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '0.5px', marginBottom: '3px' }}>
            {selectedSymbol.replace('-', ' (')} {selectedSymbol.includes('-') ? ')' : ''}
          </h3>
          {price ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '21px', fontWeight: '700', color: isUp ? '#26a69a' : '#ef5350' }}>
                ₹{price.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              {pct !== null && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  background: isUp ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)',
                  color: isUp ? '#26a69a' : '#ef5350',
                  padding: '2px 7px', borderRadius: '5px', fontSize: '12px', fontWeight: '600'
                }}>
                  {isUp ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                  {change > 0 ? '+' : ''}{change} ({pct > 0 ? '+' : ''}{pct}%)
                </span>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Loading price…</div>
          )}
        </div>

        {/* Timeframe row */}
        <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '8px', flexShrink: 0 }}>
          {TIMEFRAMES.map(tf => {
            const active = chartInterval === tf.value;
            return (
              <button
                key={tf.value}
                onClick={() => setChartInterval(tf.value)}
                disabled={isLoadingCandles}
                style={{
                  background: active ? 'rgba(96,165,250,0.18)' : 'transparent',
                  color:      active ? '#60A5FA' : '#64748B',
                  border:     active ? '1px solid rgba(96,165,250,0.35)' : '1px solid transparent',
                  borderRadius: '5px', padding: '3px 7px',
                  fontSize: '11px', fontWeight: '700', cursor: isLoadingCandles ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >{tf.label}</button>
            );
          })}
        </div>
      </div>

      {/* ── Row 2: OHLC ── */}
      {(hoveredCandle || price) && (
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', marginBottom: '8px' }}>
          {[['O', hoveredCandle?.open ?? price?.open], 
            ['H', hoveredCandle?.high ?? price?.high], 
            ['L', hoveredCandle?.low ?? price?.low], 
            ['C', hoveredCandle?.close ?? price?.close],
            ['Vol', hoveredCandle?.volume ?? price?.volume]]
            .map(([lbl, val]) =>
            val != null ? (
              <span key={lbl}>
                <span style={{ color: '#475569' }}>{lbl} </span>
                <span style={{ color: '#CBD5E1', fontWeight: '600' }}>
                  {lbl === 'Vol' ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, notation: "compact" }).format(val) : `₹${Number(val).toFixed(2)}`}
                </span>
              </span>
            ) : null
          )}
        </div>
      )}

      {/* ── Chart area (always mounted so createChart never breaks) ── */}
      <div style={{ position: 'relative', width: '100%', height: '400px' }}>
        <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Quick Order Buttons Overlay */}
        {price && !isLoadingCandles && (
          <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 5, display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              onClick={() => openOrderModal(selectedSymbol, 'SELL', 1)}
              style={{
                background: '#F0533C', color: '#fff', border: 'none', borderRadius: '4px',
                padding: '4px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'background 0.2s',
                lineHeight: '1.2'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#d64530'}
              onMouseOut={e => e.currentTarget.style.background = '#F0533C'}
            >
              <div style={{ fontSize: '13px', fontWeight: '800' }}>{price.ltp.toFixed(2)}</div>
              <div style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '0.5px' }}>SELL</div>
            </button>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>0.00</span>
            <button 
              onClick={() => openOrderModal(selectedSymbol, 'BUY', 1)}
              style={{
                background: '#0FB384', color: '#fff', border: 'none', borderRadius: '4px',
                padding: '4px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'background 0.2s',
                lineHeight: '1.2'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#0d9b73'}
              onMouseOut={e => e.currentTarget.style.background = '#0FB384'}
            >
              <div style={{ fontSize: '13px', fontWeight: '800' }}>{price.ltp.toFixed(2)}</div>
              <div style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '0.5px' }}>BUY</div>
            </button>
          </div>
        )}

        {/* Loading overlay */}
        {isLoadingCandles && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(10,15,28,0.72)', backdropFilter: 'blur(3px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '8px', zIndex: 10,
          }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid rgba(96,165,250,0.2)', borderTop: '3px solid #60A5FA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '600' }}>
              Loading {tfLabel} chart for {selectedSymbol}…
            </div>
          </div>
        )}

        {/* Error / no-data overlay */}
        {!isLoadingCandles && (candleError || candles.length === 0) && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '10px',
          }}>
            <div style={{ fontSize: '28px' }}>📉</div>
            <div style={{ color: '#64748B', fontSize: '13px', fontWeight: '600' }}>
              {candleError || `No ${tfLabel} data for ${selectedSymbol}`}
            </div>
            <button
              onClick={() => loadCandleData(selectedSymbol, chartInterval)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(96,165,250,0.12)', color: '#60A5FA',
                border: '1px solid rgba(96,165,250,0.3)', borderRadius: '6px',
                padding: '5px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
