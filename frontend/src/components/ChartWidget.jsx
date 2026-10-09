import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { SMA, EMA, RSI, MACD } from 'technicalindicators';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import StockDetails from './StockDetails';

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

export default function ChartWidget({
  isModal = false,
  isMobile: propIsMobile,
  isLandscape = false,
  activeView = 'chart',
  onClose
}) {
  const chartContainerRef = useRef(null);
  const chartRef          = useRef(null);
  const candleSeriesRef   = useRef(null);
  const volumeSeriesRef   = useRef(null);
  const liveLineRef       = useRef(null);
  const smaSeriesRef      = useRef(null);
  const emaSeriesRef      = useRef(null);
  const rsiSeriesRef      = useRef(null);
  const macdSeriesRef     = useRef(null);
  const macdSignalSeriesRef = useRef(null);
  const macdHistSeriesRef = useRef(null);
  const lastCandleRef     = useRef(null);
  const mountedRef        = useRef(true);

  const [internalIsMobile, setInternalIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  useEffect(() => {
    if (propIsMobile !== undefined) return;
    const check = () => setInternalIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [propIsMobile]);

  const isMobile = propIsMobile !== undefined ? propIsMobile : internalIsMobile;

  const [hoveredCandle, setHoveredCandle] = useState(null);
  
  // Indicator Toggles
  const [showSMA, setShowSMA] = useState(false);
  const [showEMA, setShowEMA] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);

  const { selectedSymbol, candleData, isLoadingCandles, candleError, chartInterval, setChartInterval, loadCandleData, openOrderModal, theme } = useStore(useShallow(state => ({ selectedSymbol: state.selectedSymbol, candleData: state.candleData, isLoadingCandles: state.isLoadingCandles, candleError: state.candleError, chartInterval: state.chartInterval, setChartInterval: state.setChartInterval, loadCandleData: state.loadCandleData, openOrderModal: state.openOrderModal, theme: state.theme })));

  const price   = useStore(state => state.prices[state.selectedSymbol]);
  const candles = candleData[selectedSymbol] || [];
  const isLight = theme === 'light';

  // ── Build chart instance ────────────────────────────────────────────────────
  const buildChart = useCallback(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch (_) {}
      chartRef.current = null;
    }

    // Adjust chart height based on active oscillators
    let numOscillators = 0;
    if (showRSI) numOscillators++;
    if (showMACD) numOscillators++;
    
    // Main chart gets 60% if 2 oscillators, 75% if 1, 100% if 0
    const mainBottom = numOscillators === 2 ? 0.4 : (numOscillators === 1 ? 0.25 : 0);
    const rsiTop = mainBottom;
    const rsiBottom = showMACD ? 0.2 : 0;
    const macdTop = numOscillators === 2 ? 0.8 : (showMACD ? 0.75 : 0);

    // Use available height or fallback to fixed calculation
    const containerHeight = chartContainerRef.current.clientHeight;
    const baseHeight = containerHeight > 0 ? containerHeight : 400;
    const chartHeight = Math.max(300, baseHeight);

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: isLight ? '#475569' : '#94A3B8',
        fontSize: 11,
        fontFamily: "'Inter', 'Roboto', sans-serif",
      },
      grid: {
        vertLines: { color: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)' },
        horzLines: { color: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: isLight ? '#94a3b8' : '#334155', width: 1, style: 1, labelBackgroundColor: isLight ? '#334155' : '#1E293B' },
        horzLine: { color: isLight ? '#94a3b8' : '#334155', width: 1, style: 1, labelBackgroundColor: isLight ? '#334155' : '#1E293B' },
      },
      rightPriceScale: {
        borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.07)',
        scaleMargins: { top: 0.05, bottom: mainBottom + 0.05 },
      },
      timeScale: {
        borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.07)',
        timeVisible: true,
        secondsVisible: false,
      },
      width:  chartContainerRef.current.clientWidth,
      height: chartHeight,
      handleScroll: true,
      handleScale:  true,
    });
    chartRef.current = chart;

    // Candlestick
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: isLight ? '#089981' : '#26a69a',
      downColor: isLight ? '#f23645' : '#ef5350',
      borderUpColor: isLight ? '#089981' : '#26a69a',
      borderDownColor: isLight ? '#f23645' : '#ef5350',
      wickUpColor: isLight ? '#089981' : '#26a69a',
      wickDownColor: isLight ? '#f23645' : '#ef5350',
    });

    // Volume histogram on main scale
    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.9 - mainBottom, bottom: mainBottom },
    });

    // Indicators on Main Chart
    smaSeriesRef.current = chart.addSeries(LineSeries, { color: '#F59E0B', lineWidth: 2, crosshairMarkerVisible: false, visible: showSMA });
    emaSeriesRef.current = chart.addSeries(LineSeries, { color: '#8B5CF6', lineWidth: 2, crosshairMarkerVisible: false, visible: showEMA });

    // RSI Pane
    if (showRSI) {
      rsiSeriesRef.current = chart.addSeries(LineSeries, { color: '#EAB308', lineWidth: 2, priceScaleId: 'rsi', crosshairMarkerVisible: false });
      chart.priceScale('rsi').applyOptions({ scaleMargins: { top: rsiTop + 0.05, bottom: rsiBottom + 0.05 } });
    }

    // MACD Pane
    if (showMACD) {
      macdSeriesRef.current = chart.addSeries(LineSeries, { color: '#3B82F6', lineWidth: 2, priceScaleId: 'macd', crosshairMarkerVisible: false });
      macdSignalSeriesRef.current = chart.addSeries(LineSeries, { color: '#EF4444', lineWidth: 2, priceScaleId: 'macd', crosshairMarkerVisible: false });
      macdHistSeriesRef.current = chart.addSeries(HistogramSeries, { priceScaleId: 'macd' });
      chart.priceScale('macd').applyOptions({ scaleMargins: { top: macdTop + 0.05, bottom: 0.05 } });
    }

    // Dotted live-price line
    liveLineRef.current = chart.addSeries(LineSeries, {
      color: '#60A5FA', lineWidth: 1, lineStyle: 2,
      priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const ro = new ResizeObserver(() => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight > 0 ? chartContainerRef.current.clientHeight : 400
        });
      }
    });
    ro.observe(chartContainerRef.current);

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
  }, [showSMA, showEMA, showRSI, showMACD]);

  // Rebuild chart when symbol, interval, or indicators change
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
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      liveLineRef.current = null;
      smaSeriesRef.current = null;
      emaSeriesRef.current = null;
      rsiSeriesRef.current = null;
      macdSeriesRef.current = null;
      macdSignalSeriesRef.current = null;
      macdHistSeriesRef.current = null;
      lastCandleRef.current = null;
    };
  }, [selectedSymbol, chartInterval, showSMA, showEMA, showRSI, showMACD]);

  const applyLiveTickToCandle = useCallback((currentPrice) => {
    if (!mountedRef.current || !currentPrice || !Number.isFinite(Number(currentPrice.ltp))) return;
    const ltp = Number(currentPrice.ltp);
    const rawTs = currentPrice.timestamp ? Math.floor(new Date(currentPrice.timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000);
    const tickSec = (rawTs > 0 ? rawTs : Math.floor(Date.now() / 1000)) + 19800;

    if (candleSeriesRef.current && lastCandleRef.current) {
      const prev = lastCandleRef.current;
      const intervalSecMap = {
        ONE_MINUTE: 60,
        THREE_MINUTE: 180,
        FIVE_MINUTE: 300,
        TEN_MINUTE: 600,
        FIFTEEN_MINUTE: 900,
        THIRTY_MINUTE: 1800,
        ONE_HOUR: 3600,
        ONE_DAY: 86400,
      };
      const intervalSec = intervalSecMap[chartInterval] || 300;
      const elapsed = tickSec - prev.time;

      let updatedBar;
      if (elapsed >= intervalSec) {
        const steps = Math.floor(elapsed / intervalSec);
        const barTime = prev.time + steps * intervalSec;
        if (chartInterval === 'ONE_DAY') {
          const dayOpen = Number(currentPrice.open) > 0 ? Number(currentPrice.open) : ltp;
          const dayHigh = Number(currentPrice.high) > 0 ? Math.max(Number(currentPrice.high), ltp, dayOpen) : Math.max(ltp, dayOpen);
          const dayLow  = Number(currentPrice.low)  > 0 ? Math.min(Number(currentPrice.low),  ltp, dayOpen) : Math.min(ltp, dayOpen);
          updatedBar = { time: barTime, open: dayOpen, high: dayHigh, low: dayLow, close: ltp, volume: Number(currentPrice.volume) || 0 };
        } else {
          updatedBar = { time: barTime, open: ltp, high: ltp, low: ltp, close: ltp, volume: 0 };
        }
      } else {
        if (chartInterval === 'ONE_DAY') {
          const dayOpen = Number(currentPrice.open) > 0 ? Number(currentPrice.open) : prev.open;
          const dayHigh = Math.max(prev.high, Number(currentPrice.high) || ltp, ltp);
          const dayLow  = Math.min(prev.low,  Number(currentPrice.low)  || ltp, ltp);
          updatedBar = { ...prev, open: dayOpen, high: dayHigh, low: dayLow, close: ltp };
        } else {
          updatedBar = {
            ...prev,
            high: Math.max(prev.high, ltp),
            low: Math.min(prev.low, ltp),
            close: ltp,
          };
        }
      }

      lastCandleRef.current = updatedBar;
      try {
        candleSeriesRef.current.update({
          time: updatedBar.time,
          open: updatedBar.open,
          high: updatedBar.high,
          low: updatedBar.low,
          close: updatedBar.close,
        });
      } catch (_) {}
      if (liveLineRef.current) {
        try {
          liveLineRef.current.update({ time: updatedBar.time, value: ltp });
        } catch (_) {}
      }
    }
  }, [chartInterval]);

  // Push candle and indicator data into chart
  useEffect(() => {
    if (!mountedRef.current || !candleSeriesRef.current || candles.length === 0) return;

    try {
      // Deduplicate candles by time to prevent Lightweight Charts from silently crashing
      const uniqueCandles = [];
      const seenTime = new Set();
      for (const c of candles) {
        if (!seenTime.has(c.time)) {
          seenTime.add(c.time);
          uniqueCandles.push(c);
        }
      }

      // Ensure they are strictly sorted by time just in case
      uniqueCandles.sort((a, b) => a.time - b.time);

      candleSeriesRef.current.setData(uniqueCandles);

      const volData = uniqueCandles.map(c => ({
        time:  c.time,
        value: c.volume || 0,
        color: c.close >= c.open ? 'rgba(38,166,154,0.45)' : 'rgba(239,83,80,0.45)',
      }));
      volumeSeriesRef.current?.setData(volData);

      // Compute Indicators
      const closePrices = uniqueCandles.map(c => c.close);
      const times = uniqueCandles.map(c => c.time);

      if (showSMA && smaSeriesRef.current) {
        const smaPeriod = 20;
        const smaVals = SMA.calculate({ period: smaPeriod, values: closePrices });
        const smaData = [];
        for (let i = 0; i < smaVals.length; i++) {
          smaData.push({ time: times[i + (smaPeriod - 1)], value: smaVals[i] });
        }
        smaSeriesRef.current.setData(smaData);
      }

      if (showEMA && emaSeriesRef.current) {
        const emaPeriod = 20;
        const emaVals = EMA.calculate({ period: emaPeriod, values: closePrices });
        const emaData = [];
        for (let i = 0; i < emaVals.length; i++) {
          emaData.push({ time: times[i + (emaPeriod - 1)], value: emaVals[i] });
        }
        emaSeriesRef.current.setData(emaData);
      }

      if (showRSI && rsiSeriesRef.current) {
        const rsiPeriod = 14;
        const rsiVals = RSI.calculate({ period: rsiPeriod, values: closePrices });
        const rsiData = [];
        for (let i = 0; i < rsiVals.length; i++) {
          rsiData.push({ time: times[i + rsiPeriod], value: rsiVals[i] });
        }
        rsiSeriesRef.current.setData(rsiData);
      }

      if (showMACD && macdSeriesRef.current && macdSignalSeriesRef.current && macdHistSeriesRef.current) {
        const macdVals = MACD.calculate({
          values: closePrices,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
          SimpleMAOscillator: false,
          SimpleMASignal: false
        });
        
        const macdLine = [];
        const signalLine = [];
        const histLine = [];
        
        // MACD calculation requires 26 periods to start
        for (let i = 0; i < macdVals.length; i++) {
          const t = times[i + 25]; 
          if (!t) continue;
          macdLine.push({ time: t, value: macdVals[i].MACD });
          signalLine.push({ time: t, value: macdVals[i].signal });
          histLine.push({ 
            time: t, 
            value: macdVals[i].histogram, 
            color: macdVals[i].histogram >= 0 ? 'rgba(38,166,154,0.7)' : 'rgba(239,83,80,0.7)'
          });
        }
        
        macdSeriesRef.current.setData(macdLine);
        macdSignalSeriesRef.current.setData(signalLine);
        macdHistSeriesRef.current.setData(histLine);
      }

      const last = uniqueCandles[uniqueCandles.length - 1];
      if (last) {
        lastCandleRef.current = { ...last };
        liveLineRef.current?.setData([{ time: last.time, value: last.close }]);
        if (price) applyLiveTickToCandle(price);
      }

      chartRef.current?.timeScale().fitContent();
    } catch (e) { console.error(e) }
  }, [candles, showSMA, showEMA, showRSI, showMACD, theme, applyLiveTickToCandle]);

  // Live tick update
  useEffect(() => {
    if (!mountedRef.current || !price) return;
    applyLiveTickToCandle(price);
  }, [price, selectedSymbol, applyLiveTickToCandle]);

  const isUp   = (price?.pct ?? 0) >= 0;
  const pct    = price?.pct    != null ? Number(price.pct).toFixed(2)    : null;
  const change = price?.change != null ? Number(price.change).toFixed(2) : null;
  const tfLabel = TIMEFRAMES.find(t => t.value === chartInterval)?.label ?? chartInterval;

  // If in modal and user selected details view, render StockDetails directly
  if (isModal && activeView === 'details') {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px 8px' : '16px 20px', background: isLight ? '#f8fafc' : '#0b1120' }}>
        {selectedSymbol && price ? (
          <StockDetails symbol={selectedSymbol} price={price} candles={candles} />
        ) : (
          <div style={{ color: '#94a3b8', padding: '30px', textAlign: 'center' }}>Loading details for {selectedSymbol}...</div>
        )}
      </div>
    );
  }

  return (
    <div
      className={isModal ? "" : "glass-panel"}
      style={{
        padding: isMobile ? (isModal ? '4px 6px 0 6px' : '8px 10px') : (isModal ? '8px 16px' : '16px 20px'),
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
        overflowY: isModal ? 'hidden' : 'auto',
        background: isModal ? (isLight ? '#f8fafc' : '#0b1120') : undefined,
        border: isModal ? 'none' : undefined
      }}
    >
      {/* ── Non-modal Header Row (when rendered in main dashboard / tab) ── */}
      {!isModal && (
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          marginBottom: '8px',
          gap: '8px'
        }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '0.5px', marginBottom: '3px', color: 'var(--text-primary)' }}>
              {selectedSymbol.replace('-', ' (')} {selectedSymbol.includes('-') ? ')' : ''}
            </h3>
            {price ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '20px', fontWeight: '700', color: isUp ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                  ₹{price.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                {pct !== null && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    background: isUp ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                    color: isUp ? 'var(--color-green-light)' : 'var(--color-red-light)',
                    padding: '2px 7px', borderRadius: '5px', fontSize: '12px', fontWeight: '600'
                  }}>
                    {isUp ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                    {change > 0 ? '+' : ''}{change} ({pct > 0 ? '+' : ''}{pct}%)
                  </span>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>No live price</div>
            )}
          </div>

          {/* Timeframes for desktop main tab */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-hover)', padding: '3px', borderRadius: '8px', flexShrink: 0, border: '1px solid var(--border-color)' }}>
              {TIMEFRAMES.map(tf => {
                const active = chartInterval === tf.value;
                return (
                  <button
                    key={tf.value}
                    onClick={() => setChartInterval(tf.value)}
                    disabled={isLoadingCandles}
                    style={{
                      background: active ? 'var(--color-blue)' : 'transparent',
                      color:      active ? '#ffffff' : 'var(--text-secondary)',
                      border:     'none',
                      borderRadius: '5px', padding: '4px 8px',
                      fontSize: '11px', fontWeight: '700', cursor: isLoadingCandles ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >{tf.label}</button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Timeframe Selector Bar (Dedicated Row on Mobile or inside Modal) ── */}
      {(isMobile || isModal) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          padding: '2px 0 4px 0',
          marginBottom: '4px',
          flexShrink: 0
        }}>
          {TIMEFRAMES.map(tf => {
            const active = chartInterval === tf.value;
            return (
              <button
                key={tf.value}
                onClick={() => setChartInterval(tf.value)}
                disabled={isLoadingCandles}
                style={{
                  background: active ? 'var(--color-blue, #2563eb)' : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255, 255, 255, 0.05)'),
                  color: active ? '#ffffff' : 'var(--text-secondary, #94a3b8)',
                  border: active ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  padding: '4px 9px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: isLoadingCandles ? 'default' : 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Indicators Bar (Horizontally scrollable on mobile) ── */}
      <div style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
        padding: '2px 0',
        marginBottom: '5px',
        flexShrink: 0
      }}>
        <IndicatorButton label="SMA (20)" active={showSMA} onClick={() => setShowSMA(!showSMA)} color="#F59E0B" />
        <IndicatorButton label="EMA (20)" active={showEMA} onClick={() => setShowEMA(!showEMA)} color="#8B5CF6" />
        <IndicatorButton label="RSI (14)" active={showRSI} onClick={() => setShowRSI(!showRSI)} color="#EAB308" />
        <IndicatorButton label="MACD" active={showMACD} onClick={() => setShowMACD(!showMACD)} color="#3B82F6" />
      </div>

      {/* ── OHLC Overlay ── */}
      {(hoveredCandle || price) && (
        <div style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
          fontSize: '10.5px',
          marginBottom: '5px',
          padding: '1px 0',
          flexShrink: 0
        }}>
          {[['O', hoveredCandle?.open ?? price?.open], 
            ['H', hoveredCandle?.high ?? price?.high], 
            ['L', hoveredCandle?.low ?? price?.low], 
            ['C', hoveredCandle?.close ?? price?.ltp ?? price?.close],
            ['Vol', hoveredCandle?.volume ?? price?.volume]]
            .map(([lbl, val]) =>
            val != null ? (
              <span key={lbl} style={{ flexShrink: 0 }}>
                <span style={{ color: '#64748b' }}>{lbl} </span>
                <span style={{ color: '#cbd5e1', fontWeight: '600' }}>
                  {lbl === 'Vol' ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, notation: "compact" }).format(val) : `₹${Number(val).toFixed(2)}`}
                </span>
              </span>
            ) : null
          )}
        </div>
      )}

      {/* ── Chart area ── */}
      <div style={{
        position: 'relative',
        width: '100%',
        flex: 1,
        minHeight: isMobile ? (isLandscape ? 'calc(100vw - 110px)' : (isModal ? 'calc(100dvh - 215px)' : '340px')) : '420px',
        overflow: 'hidden'
      }}>
        <div ref={chartContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />

        {/* Quick Order Buttons Overlay (Desktop Only - Avoid blocking candles on mobile) */}
        {!isMobile && price && !isLoadingCandles && (
          <div style={{ position: 'absolute', top: '12px', left: '0px', zIndex: 5, display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button 
              onClick={() => openOrderModal(selectedSymbol, 'SELL', price?.lotsize || 1, 'INT', false, 0, price?.ltp)}
              style={{
                background: '#F0533C', color: '#fff', border: 'none', borderRadius: '4px',
                padding: '3px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'background 0.2s',
                lineHeight: '1.2', minWidth: '46px'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#d64530'}
              onMouseOut={e => e.currentTarget.style.background = '#F0533C'}
            >
              <div style={{ fontSize: '11px', fontWeight: '800' }}>{price?.ltp !== undefined && price?.ltp !== null ? Number(price.ltp).toFixed(2) : '--'}</div>
              <div style={{ fontSize: '9px', fontWeight: '600', letterSpacing: '0.5px' }}>SELL</div>
              <div style={{ fontSize: '8px', opacity: 0.8 }}>Shift+S</div>
            </button>
            <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>0.00</span>
            <button 
              onClick={() => openOrderModal(selectedSymbol, 'BUY', price?.lotsize || 1, 'INT', false, 0, price?.ltp)}
              style={{
                background: '#0FB384', color: '#fff', border: 'none', borderRadius: '4px',
                padding: '3px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'background 0.2s',
                lineHeight: '1.2', minWidth: '46px'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#0d9b73'}
              onMouseOut={e => e.currentTarget.style.background = '#0FB384'}
            >
              <div style={{ fontSize: '11px', fontWeight: '800' }}>{price?.ltp !== undefined && price?.ltp !== null ? Number(price.ltp).toFixed(2) : '--'}</div>
              <div style={{ fontSize: '9px', fontWeight: '600', letterSpacing: '0.5px' }}>BUY</div>
              <div style={{ fontSize: '8px', opacity: 0.8 }}>Shift+B</div>
            </button>
          </div>
        )}

        {/* Loading overlay */}
        {isLoadingCandles && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(10,15,28,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '8px', zIndex: 10,
          }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid rgba(96,165,250,0.2)', borderTop: '3px solid #60A5FA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '600' }}>
              Loading {tfLabel} chart for {selectedSymbol}…
            </div>
          </div>
        )}

        {/* Error overlay */}
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
      
      {/* Mobile Sticky Bottom Trading Action Bar */}
      {isMobile && price && (
        <div style={{
          position: isModal ? 'sticky' : 'relative',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 25,
          background: isLight ? '#ffffff' : '#0f172a',
          borderTop: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
          padding: '8px 12px',
          display: 'flex',
          gap: '10px',
          flexShrink: 0,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.25)'
        }}>
          <button
            onClick={() => openOrderModal(selectedSymbol, 'BUY', price?.lotsize || 1, 'INT', false, 0, price?.ltp)}
            style={{
              flex: 1,
              background: '#0FB384',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '11px 16px',
              fontSize: '13.5px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(15, 179, 132, 0.35)',
            }}
          >
            ⚡ BUY {price?.ltp ? `₹${Number(price.ltp).toFixed(2)}` : ''}
          </button>
          <button
            onClick={() => openOrderModal(selectedSymbol, 'SELL', price?.lotsize || 1, 'INT', false, 0, price?.ltp)}
            style={{
              flex: 1,
              background: '#F0533C',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '11px 16px',
              fontSize: '13.5px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(240, 83, 60, 0.35)',
            }}
          >
            ⚡ SELL {price?.ltp ? `₹${Number(price.ltp).toFixed(2)}` : ''}
          </button>
        </div>
      )}

      {/* StockDetails for Non-Modal Desktop view */}
      {!isModal && selectedSymbol && price && (
        <StockDetails symbol={selectedSymbol} price={price} candles={candles} />
      )}
    </div>
  );
}

function IndicatorButton({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className={`chart-tool-pill ${active ? 'active' : ''}`}
      style={{ '--pill-color': color }}
    >
      {active && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />}
      {label}
    </button>
  );
}


