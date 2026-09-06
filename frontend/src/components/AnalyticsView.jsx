import { useShallow } from 'zustand/react/shallow';
import React, { useEffect, useState, useMemo } from 'react';
import { useStore, API } from '../store';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Activity, 
  Award, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  BarChart3,
  Clock
} from 'lucide-react';

export default function AnalyticsView() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { user } = useStore(useShallow(state => ({ user: state.user })));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('ALL'); // '1W', '1M', '3M', 'YTD', 'ALL'

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`${API}/api/analytics`, {
          credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchAnalytics();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Currency Formatter Helper (Indian Notation)
  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0.00';
    const num = Number(val);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}k`;
    return `${sign}₹${abs.toFixed(2)}`;
  };

  const formatShortCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    const num = Number(val);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(0)}k`;
    return `${sign}₹${abs.toFixed(0)}`;
  };

  // Filter Equity Curve based on selected timeframe
  const filteredEquityCurve = useMemo(() => {
    if (!data?.equityCurve || data.equityCurve.length === 0) return [];
    if (timeframe === 'ALL') return data.equityCurve;

    const now = new Date();
    let cutoff = new Date();

    if (timeframe === '1W') {
      cutoff.setDate(now.getDate() - 7);
    } else if (timeframe === '1M') {
      cutoff.setMonth(now.getMonth() - 1);
    } else if (timeframe === '3M') {
      cutoff.setMonth(now.getMonth() - 3);
    } else if (timeframe === 'YTD') {
      cutoff = new Date(now.getFullYear(), 0, 1);
    }

    const filtered = data.equityCurve.filter(item => new Date(item.date) >= cutoff);
    return filtered.length > 0 ? filtered : data.equityCurve;
  }, [data, timeframe]);

  // Advanced Stats Calculation
  const stats = useMemo(() => {
    if (!data) return {};
    const { totalTrades, winningTrades, losingTrades, avgWinner, avgLoser, equityCurve } = data;
    const curve = equityCurve || [];

    const totalProfit = (winningTrades || 0) * parseFloat(avgWinner || 0);
    const totalLoss = (losingTrades || 0) * parseFloat(avgLoser || 0);
    const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : totalProfit > 0 ? '∞' : '0.00';

    let peak = 0;
    let maxDrawdown = 0;
    let netEquity = 0;

    curve.forEach(pt => {
      if (pt.cumulative > peak) {
        peak = pt.cumulative;
      }
      const dd = peak - pt.cumulative;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }
      netEquity = pt.cumulative;
    });

    const isPositiveCurve = netEquity >= 0;

    return {
      profitFactor,
      peak,
      maxDrawdown,
      netEquity,
      isPositiveCurve,
      winLossRatio: losingTrades > 0 ? (winningTrades / losingTrades).toFixed(1) : winningTrades > 0 ? 'MAX' : '0.0'
    };
  }, [data]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '12px' }}>
        <Activity size={32} className="animate-spin" style={{ color: 'var(--color-blue)' }} />
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading analytics performance data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '30px', textAlign: 'center', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
        No analytics data available yet. Place trades to generate analytics reports.
      </div>
    );
  }

  const { totalTrades, winningTrades, losingTrades, winRate, avgWinner, avgLoser, recentTrades } = data;
  const isNetPositive = stats.netEquity >= 0;

  // Custom Glassmorphic Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const pt = payload[0].payload;
      const isPointPositive = pt.cumulative >= 0;
      const isDailyPositive = (pt.pnl || 0) >= 0;
      const formattedDate = new Date(pt.date).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      return (
        <div style={{
          background: 'var(--bg-panel)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border-color)',
          padding: '14px 18px',
          borderRadius: '12px',
          boxShadow: 'var(--card-shadow, 0 12px 30px rgba(0,0,0,0.15))',
          minWidth: '220px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <Calendar size={13} />
            <span>{formattedDate}</span>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Cumulative Equity</div>
            <div style={{ 
              fontSize: '18px', 
              fontWeight: '700', 
              color: isPointPositive ? '#00E676' : '#FF3B30',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {isPointPositive ? '+' : ''}{formatCurrency(pt.cumulative)}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-color)', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Daily P&L:</span>
            <span style={{ 
              fontWeight: '600', 
              color: isDailyPositive ? '#00E676' : '#FF3B30',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}>
              {isDailyPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {isDailyPositive ? '+' : ''}{formatCurrency(pt.pnl || 0)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: 'var(--text-primary)', width: '100%' }}>
      
      {/* Top Key Performance Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '14px' }}>
        
        {/* Total Trades Card */}
        <div className="glass-panel" style={{
          background: 'var(--bg-panel)',
          padding: isMobile ? '14px' : '18px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--card-shadow, 0 4px 20px rgba(0,0,0,0.08))',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '12px', fontWeight: '500' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={15} style={{ color: '#2563eb' }} /> Total Trades
            </span>
            <span style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>EXECUTED</span>
          </div>
          <div style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '700', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
            {totalTrades}
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span style={{ color: '#00E676', fontWeight: '600' }}>{winningTrades} W</span>
            <span>•</span>
            <span style={{ color: '#FF3B30', fontWeight: '600' }}>{losingTrades} L</span>
          </div>
        </div>

        {/* Win Rate Card */}
        <div className="glass-panel" style={{
          background: 'var(--bg-panel)',
          padding: isMobile ? '14px' : '18px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--card-shadow, 0 4px 20px rgba(0,0,0,0.08))',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '12px', fontWeight: '500' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={15} style={{ color: parseFloat(winRate) >= 50 ? '#00E676' : '#EAB308' }} /> Win Rate
            </span>
            <span style={{ 
              background: parseFloat(winRate) >= 50 ? 'rgba(0, 230, 118, 0.1)' : 'rgba(234, 179, 8, 0.1)', 
              color: parseFloat(winRate) >= 50 ? '#00E676' : '#EAB308', 
              padding: '2px 6px', 
              borderRadius: '4px', 
              fontSize: '10px', 
              fontWeight: '600' 
            }}>
              {parseFloat(winRate) >= 50 ? 'ACCURATE' : 'MODERATE'}
            </span>
          </div>
          <div style={{ 
            fontSize: isMobile ? '20px' : '26px', 
            fontWeight: '700', 
            letterSpacing: '-0.5px',
            color: parseFloat(winRate) >= 50 ? '#00E676' : '#EAB308'
          }}>
            {winRate}%
          </div>
          {/* Mini progress bar */}
          <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, Math.max(0, parseFloat(winRate)))}%`, height: '100%', background: parseFloat(winRate) >= 50 ? 'linear-gradient(90deg, #00E676, #2563eb)' : '#EAB308', borderRadius: '2px' }} />
          </div>
        </div>

        {/* Profit Factor Card */}
        <div className="glass-panel" style={{
          background: 'var(--bg-panel)',
          padding: isMobile ? '14px' : '18px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--card-shadow, 0 4px 20px rgba(0,0,0,0.08))',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '12px', fontWeight: '500' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={15} style={{ color: '#a855f7' }} /> Profit Factor
            </span>
            <span style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>P/L RATIO</span>
          </div>
          <div style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '700', letterSpacing: '-0.5px', color: '#9333ea' }}>
            {stats.profitFactor}x
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Win/Loss: <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{stats.winLossRatio}:1</span>
          </div>
        </div>

        {/* Avg Winner vs Loser Card */}
        <div className="glass-panel" style={{
          background: 'var(--bg-panel)',
          padding: isMobile ? '14px' : '18px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--card-shadow, 0 4px 20px rgba(0,0,0,0.08))',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '12px', fontWeight: '500' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={15} style={{ color: '#00E676' }} /> Avg Win / Loss
            </span>
            <span style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>PER TRADE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: isMobile ? '16px' : '19px', fontWeight: '700', color: '#00E676' }}>
              +₹{parseFloat(avgWinner).toFixed(0)}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>/</span>
            <span style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: '#FF3B30' }}>
              -₹{parseFloat(avgLoser).toFixed(0)}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Payoff Ratio: <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{parseFloat(avgLoser) > 0 ? (parseFloat(avgWinner) / parseFloat(avgLoser)).toFixed(2) : '1.00'}x</span>
          </div>
        </div>

      </div>

      {/* Modern Cumulative Equity Curve Section */}
      <div className="glass-panel" style={{
        background: 'var(--bg-panel)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: isMobile ? '16px' : '22px',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--card-shadow, 0 8px 32px rgba(0, 0, 0, 0.08))',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        
        {/* Header with Title, Stats & Timeframe Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: '12px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '14px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: '700', letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
                Cumulative Equity Curve
              </h3>
              <span style={{
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 8px',
                borderRadius: '12px',
                background: isNetPositive ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                color: isNetPositive ? '#00E676' : '#FF3B30',
                border: `1px solid ${isNetPositive ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 59, 48, 0.3)'}`
              }}>
                {isNetPositive ? 'PROFITABLE' : 'DRAWDOWN'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '13px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Net P&L: </span>
                <span style={{ fontWeight: '700', color: isNetPositive ? '#00E676' : '#FF3B30' }}>
                  {isNetPositive ? '+' : ''}{formatCurrency(stats.netEquity)}
                </span>
              </div>
              <div style={{ color: 'var(--border-color)' }}>|</div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Peak Equity: </span>
                <span style={{ fontWeight: '600', color: '#2563eb' }}>{formatCurrency(stats.peak)}</span>
              </div>
              <div style={{ color: 'var(--border-color)' }}>|</div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Max DD: </span>
                <span style={{ fontWeight: '600', color: '#f87171' }}>-{formatCurrency(stats.maxDrawdown)}</span>
              </div>
            </div>
          </div>

          {/* Timeframe Selector Pill Group */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-card)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            alignSelf: isMobile ? 'stretch' : 'auto',
            justifyContent: isMobile ? 'space-between' : 'flex-start'
          }}>
            {['1W', '1M', '3M', 'YTD', 'ALL'].map((tf) => {
              const active = timeframe === tf;
              return (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  style={{
                    background: active ? '#2563eb' : 'transparent',
                    color: active ? '#ffffff' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: isMobile ? '5px 10px' : '5px 12px',
                    fontSize: '11px',
                    fontWeight: active ? '700' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tf}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart Canvas */}
        <div style={{ height: isMobile ? '280px' : '360px', width: '100%', position: 'relative' }}>
          {filteredEquityCurve && filteredEquityCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredEquityCurve} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  {/* Glowing SVG Filters */}
                  <filter id="equityGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={isNetPositive ? '#00E676' : '#FF3B30'} floodOpacity="0.4" />
                  </filter>

                  {/* Gradient for Bullish / Profitable Equity */}
                  <linearGradient id="gradientGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00E676" stopOpacity={0.45} />
                    <stop offset="60%" stopColor="#2563eb" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#00E676" stopOpacity={0.0} />
                  </linearGradient>

                  {/* Gradient for Drawdown / Negative Equity */}
                  <linearGradient id="gradientRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF3B30" stopOpacity={0.45} />
                    <stop offset="60%" stopColor="#E11D48" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#FF3B30" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                {/* Subtle Modern Dashed Grid */}
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border-color)" vertical={false} />

                {/* X Axis */}
                <XAxis 
                  dataKey="date" 
                  stroke="var(--text-secondary)" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: 'var(--border-color)' }}
                  tickFormatter={(val) => {
                    if (!val) return '';
                    const d = new Date(val);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                  minTickGap={25}
                />

                {/* Y Axis with clean Indian notation */}
                <YAxis 
                  stroke="var(--text-secondary)" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => formatShortCurrency(val)} 
                  domain={['auto', 'auto']}
                />

                {/* Zero ₹0 Baseline Reference Line */}
                <ReferenceLine 
                  y={0} 
                  stroke="var(--text-secondary)" 
                  strokeDasharray="4 4" 
                  strokeWidth={1.2}
                  strokeOpacity={0.5}
                  label={{ 
                    value: '₹0 Baseline', 
                    position: 'insideTopRight', 
                    fill: 'var(--text-secondary)', 
                    fontSize: 10,
                    offset: 10
                  }} 
                />

                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-color)', strokeWidth: 1, strokeDasharray: '3 3' }} />

                {/* Neon Curved Area */}
                <Area 
                  type="monotone" 
                  dataKey="cumulative" 
                  stroke={isNetPositive ? '#00E676' : '#FF3B30'} 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill={isNetPositive ? 'url(#gradientGreen)' : 'url(#gradientRed)'}
                  activeDot={{ 
                    r: 6, 
                    fill: isNetPositive ? '#00E676' : '#FF3B30', 
                    stroke: '#FFFFFF', 
                    strokeWidth: 2,
                    filter: 'url(#equityGlow)'
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: '10px' }}>
              <BarChart3 size={32} style={{ opacity: 0.4 }} />
              <div>Not enough trade history to plot equity curve yet.</div>
            </div>
          )}
        </div>

      </div>

      {/* Trade Log Section */}
      <div className="glass-panel" style={{ 
        background: 'var(--bg-panel)', 
        borderRadius: '16px', 
        border: '1px solid var(--border-color)', 
        overflow: 'hidden',
        boxShadow: 'var(--card-shadow, 0 8px 32px rgba(0, 0, 0, 0.08))'
      }}>
        <div style={{ 
          padding: '16px 20px', 
          borderBottom: '1px solid var(--border-color)', 
          fontWeight: '700', 
          fontSize: '15px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <Clock size={16} style={{ color: '#2563eb' }} /> Closed Trades Performance Log
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>
            Showing last {recentTrades?.length || 0} trades
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentTrades && recentTrades.length > 0 ? recentTrades.map((trade, i) => {
                const pnl = parseFloat(trade.realized_pnl || 0);
                const isWin = pnl >= 0;
                return (
                  <div key={i} style={{ 
                    padding: '14px 16px', 
                    borderBottom: '1px solid var(--border-color)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '6px',
                    background: i % 2 === 0 ? 'var(--bg-card)' : 'transparent'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{trade.symbol}</span>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: '700', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          background: trade.side === 'BUY' ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                          color: trade.side === 'BUY' ? '#00E676' : '#FF3B30'
                        }}>
                          {trade.side}
                        </span>
                      </div>
                      <div style={{ 
                        fontWeight: '700', 
                        fontSize: '14px', 
                        color: isWin ? '#00E676' : '#FF3B30' 
                      }}>
                        {isWin ? '+' : ''}{formatCurrency(pnl)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <div>{new Date(trade.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      <div>Qty: <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{trade.quantity}</span></div>
                    </div>
                  </div>
                );
              }) : (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>No closed trades found.</div>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Date & Time</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Symbol</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Action</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Quantity</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600', textAlign: 'right' }}>Realized P&L</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades && recentTrades.length > 0 ? recentTrades.map((trade, i) => {
                  const pnl = parseFloat(trade.realized_pnl || 0);
                  const isWin = pnl >= 0;
                  return (
                    <tr key={i} style={{ 
                      borderBottom: '1px solid var(--border-color)',
                      background: i % 2 === 0 ? 'var(--bg-card)' : 'transparent',
                      transition: 'background 0.15s ease'
                    }}>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>
                        {new Date(trade.created_at).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '12px 20px', fontWeight: '700', color: 'var(--text-primary)' }}>{trade.symbol}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ 
                          padding: '3px 8px', 
                          borderRadius: '4px', 
                          fontSize: '11px', 
                          fontWeight: '700',
                          background: trade.side === 'BUY' ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                          color: trade.side === 'BUY' ? '#00E676' : '#FF3B30'
                        }}>
                          {trade.side}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px', fontWeight: '500', color: 'var(--text-primary)' }}>{trade.quantity}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '700', color: isWin ? '#00E676' : '#FF3B30' }}>
                        {isWin ? '+' : ''}{formatCurrency(pnl)}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>No closed trades found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
