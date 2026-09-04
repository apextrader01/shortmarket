import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import AnalyticsView from './AnalyticsView';
import { 
  Briefcase, 
  BarChart3, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  Coins, 
  Search, 
  Layers, 
  PieChart as PieChartIcon, 
  ArrowUpRight, 
  ArrowDownRight,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  SlidersHorizontal
} from 'lucide-react';

export default function PortfolioView() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeTab, setActiveTab] = useState('Overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('VALUE_DESC'); // 'VALUE_DESC', 'PNL_DESC', 'PNL_ASC', 'NAME_ASC'
  const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'PROFIT', 'LOSS'

  const { positions, holdings, prices, orders } = useStore(
    useShallow(state => ({ 
      positions: state.positions, 
      holdings: state.holdings, 
      prices: state.prices, 
      orders: state.orders 
    }))
  );

  // Currency Formatter Helper (Indian Notation)
  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0.00';
    const num = Number(val);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    return `${sign}₹${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatShortCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    const num = Number(val);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}k`;
    return `${sign}₹${abs.toFixed(0)}`;
  };

  let totalInvested = 0;
  let totalCurrent = 0;
  let totalInvestedStocks = 0;
  let totalInvestedETFs = 0;
  let totalInvestedDerivatives = 0;
  let totalInvestedMutualFunds = 0;
  let countStocks = 0;
  let countETFs = 0;
  let countDerivatives = 0;
  let countMutualFunds = 0;
  let unrealizedPnl = 0;

  // Only use T+1 holdings representing the portfolio view
  const allMergedHoldingsMap = {};

  (holdings || []).forEach(h => {
    allMergedHoldingsMap[h.symbol] = { ...h };
  });

  const allMergedHoldings = Object.values(allMergedHoldingsMap).filter(h => h.quantity > 0);
  const deliveryPositions = allMergedHoldings.filter(h => !h.symbol.endsWith('-MF'));

  const calculatePnL = (pos, isHolding = false) => {
    if (!pos) return;
    const priceData = prices[pos.symbol] || {};
    const ltp = priceData.ltp || parseFloat(pos.average_price) || 0;
    const qty = Math.abs(Number(pos.quantity) || 0);
    
    const invested = parseFloat(pos.average_price) * qty;
    const current = ltp * qty;
    
    let pnl = 0;
    if (Number(pos.quantity) > 0) pnl = current - invested;
    else if (Number(pos.quantity) < 0) pnl = invested - current;
    unrealizedPnl += pnl;

    // For portfolio breakdown, ONLY include T+1 Holdings (Condition 8)
    if (isHolding) {
      totalInvested += invested;
      totalCurrent += current;

      const symbolStr = pos.symbol || '';
      const cleanSym = symbolStr.replace(/^(NSE:|BSE:|MCX:)/i, '');
      
      if (symbolStr.includes('ETF') || symbolStr.includes('BEES') || symbolStr.includes('LIQUID')) {
        totalInvestedETFs += invested;
        countETFs++;
      } else if (symbolStr.includes('-MF') || symbolStr.includes('MUTUALFUND')) {
        totalInvestedMutualFunds += invested;
        countMutualFunds++;
      } else if (
        symbolStr.endsWith('CE') || symbolStr.endsWith('PE') || symbolStr.endsWith('FUT') ||
        symbolStr.includes('-MCX') || /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(cleanSym) ||
        ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'].some(c => cleanSym.startsWith(c))
      ) {
        totalInvestedDerivatives += invested;
        countDerivatives++;
      } else {
        totalInvestedStocks += invested;
        countStocks++;
      }
    }
  };

  allMergedHoldings.forEach(h => calculatePnL(h, true));
  (positions || []).filter(p => p.product_type !== 'DEL').forEach(p => calculatePnL(p, false));

  const isToday = (dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  let todayRealizedPnl = 0;
  let todayTradesCount = 0;
  if (orders) {
    orders.forEach(o => {
      const isExecuted = o.status === 'EXECUTED' || o.status === 'COMPLETED' || o.status === 'COMPLETE';
      if (isExecuted && o.realized_pnl !== null && o.realized_pnl !== undefined && isToday(o.created_at || o.updated_at)) {
        todayRealizedPnl += parseFloat(o.realized_pnl);
        todayTradesCount++;
      }
    });
  }

  const overallGain = totalCurrent - totalInvested;
  const overallPct = totalInvested > 0 ? (overallGain / totalInvested) * 100 : 0;
  const isGain = overallGain >= 0;

  // Chart Data for Asset Allocation
  const chartData = [
    { name: 'Stocks', value: totalInvestedStocks, color: '#3B82F6', count: countStocks },
    { name: 'ETFs', value: totalInvestedETFs, color: '#10B981', count: countETFs },
    { name: 'Derivatives', value: totalInvestedDerivatives, color: '#F59E0B', count: countDerivatives },
    { name: 'Mutual Funds', value: totalInvestedMutualFunds, color: '#A855F7', count: countMutualFunds }
  ].filter(d => d.value > 0);
  
  if (chartData.length === 0) {
    chartData.push({ name: 'Unallocated Cash', value: 100, color: 'rgba(255, 255, 255, 0.1)', count: 0 });
  }

  // Filter & Sort Holdings
  const processedHoldings = useMemo(() => {
    let list = deliveryPositions.map(pos => {
      const priceData = prices[pos.symbol] || {};
      const ltp = priceData.ltp || parseFloat(pos.average_price) || 0;
      const qty = Math.abs(pos.quantity);
      const invested = parseFloat(pos.average_price) * qty;
      const current = ltp * qty;
      const pnl = current - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
      return {
        ...pos,
        ltp,
        qty,
        invested,
        current,
        pnl,
        pnlPct,
        isProfit: pnl >= 0
      };
    });

    // Search filter
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      list = list.filter(p => (p.symbol || '').toLowerCase().includes(query));
    }

    // Profit/Loss filter
    if (filterType === 'PROFIT') {
      list = list.filter(p => p.pnl >= 0);
    } else if (filterType === 'LOSS') {
      list = list.filter(p => p.pnl < 0);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'VALUE_DESC') return b.current - a.current;
      if (sortBy === 'PNL_DESC') return b.pnl - a.pnl;
      if (sortBy === 'PNL_ASC') return a.pnl - b.pnl;
      if (sortBy === 'NAME_ASC') return (a.symbol || '').localeCompare(b.symbol || '');
      return 0;
    });

    return list;
  }, [deliveryPositions, prices, searchTerm, filterType, sortBy]);

  // Asset percentage helper
  const getAssetPct = (val) => {
    if (totalInvested <= 0) return '0.0';
    return ((val / totalInvested) * 100).toFixed(1);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)', height: '100%', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
      
      {/* Sub Navigation Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: isMobile ? '0 16px' : '0 28px', 
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)', 
        background: 'linear-gradient(180deg, rgba(15, 32, 60, 0.6) 0%, rgba(11, 17, 33, 0.85) 100%)',
        backdropFilter: 'blur(16px)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: isMobile ? '16px' : '28px' }}>
          {[
            { id: 'Overview', label: 'Portfolio Overview', icon: Briefcase },
            { id: 'Analytics', label: 'Trade Analytics', icon: BarChart3 }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 2px',
                  fontSize: '13.5px',
                  fontWeight: active ? '700' : '500',
                  color: active ? '#38bdf8' : 'var(--text-secondary)',
                  borderBottom: active ? '2px solid #38bdf8' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textShadow: active ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none'
                }}
              >
                <Icon size={16} style={{ color: active ? '#38bdf8' : 'var(--text-secondary)' }} />
                <span>{tab.label}</span>
              </div>
            );
          })}
        </div>

        {/* Header Live P&L Pill */}
        {!isMobile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '6px 14px',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '12px'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>Overall Return:</span>
            <span style={{ 
              fontWeight: '700', 
              color: isGain ? '#00E676' : '#FF3B30',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}>
              {isGain ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {isGain ? '+' : ''}{formatCurrency(overallGain)} ({isGain ? '+' : ''}{overallPct.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      {activeTab === 'Analytics' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: isMobile ? '12px' : '24px', paddingBottom: '60px' }}>
          <AnalyticsView />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: isMobile ? '14px' : '24px', paddingBottom: '80px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Top 4 Key Metric Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', 
            gap: isMobile ? '12px' : '16px' 
          }}>
            
            {/* Card 1: Total Portfolio Current Value */}
            <div style={{
              background: 'linear-gradient(145deg, rgba(15, 32, 60, 0.55) 0%, rgba(11, 17, 33, 0.75) 100%)',
              backdropFilter: 'blur(12px)',
              padding: isMobile ? '14px' : '18px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wallet size={14} style={{ color: '#38bdf8' }} />
                  </div>
                  <span>Current Worth</span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                  PORTFOLIO
                </span>
              </div>
              <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: '700', letterSpacing: '-0.5px', color: '#FFFFFF' }}>
                {formatCurrency(totalCurrent)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Invested:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatCurrency(totalInvested)}</span>
              </div>
            </div>

            {/* Card 2: Overall Gain / Return */}
            <div style={{
              background: 'linear-gradient(145deg, rgba(15, 32, 60, 0.55) 0%, rgba(11, 17, 33, 0.75) 100%)',
              backdropFilter: 'blur(12px)',
              padding: isMobile ? '14px' : '18px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: isGain ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 59, 48, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={14} style={{ color: isGain ? '#00E676' : '#FF3B30' }} />
                  </div>
                  <span>Total Return</span>
                </div>
                <span style={{ 
                  fontSize: '10px', 
                  fontWeight: '700', 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  background: isGain ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 59, 48, 0.12)', 
                  color: isGain ? '#00E676' : '#FF3B30' 
                }}>
                  {isGain ? 'GAIN' : 'LOSS'}
                </span>
              </div>
              <div style={{ 
                fontSize: isMobile ? '18px' : '24px', 
                fontWeight: '700', 
                letterSpacing: '-0.5px',
                color: isGain ? '#00E676' : '#FF3B30',
                textShadow: isGain ? '0 0 14px rgba(0, 230, 118, 0.3)' : '0 0 14px rgba(255, 59, 48, 0.3)'
              }}>
                {isGain ? '+' : ''}{formatCurrency(overallGain)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Return ROI:</span>
                <span style={{ color: isGain ? '#00E676' : '#FF3B30', fontWeight: '600' }}>
                  {isGain ? '+' : ''}{overallPct.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Card 3: Unrealized P&L (Live) */}
            <div style={{
              background: 'linear-gradient(145deg, rgba(15, 32, 60, 0.55) 0%, rgba(11, 17, 33, 0.75) 100%)',
              backdropFilter: 'blur(12px)',
              padding: isMobile ? '14px' : '18px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: unrealizedPnl >= 0 ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 59, 48, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unrealizedPnl >= 0 ? <TrendingUp size={14} style={{ color: '#00E676' }} /> : <TrendingDown size={14} style={{ color: '#FF3B30' }} />}
                  </div>
                  <span>Unrealized P&L</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.12)', color: '#EAB308' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00E676', display: 'inline-block' }} />
                  LIVE
                </span>
              </div>
              <div style={{ 
                fontSize: isMobile ? '18px' : '24px', 
                fontWeight: '700', 
                letterSpacing: '-0.5px',
                color: unrealizedPnl >= 0 ? '#00E676' : '#FF3B30',
                textShadow: unrealizedPnl >= 0 ? '0 0 14px rgba(0, 230, 118, 0.3)' : '0 0 14px rgba(255, 59, 48, 0.3)'
              }}>
                {unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(unrealizedPnl)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                All Open Positions
              </div>
            </div>

            {/* Card 4: Today's Realized P&L */}
            <div style={{
              background: 'linear-gradient(145deg, rgba(15, 32, 60, 0.55) 0%, rgba(11, 17, 33, 0.75) 100%)',
              backdropFilter: 'blur(12px)',
              padding: isMobile ? '14px' : '18px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Coins size={14} style={{ color: '#c084fc' }} />
                  </div>
                  <span>Today's Realized</span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' }}>
                  BOOKED
                </span>
              </div>
              <div style={{ 
                fontSize: isMobile ? '18px' : '24px', 
                fontWeight: '700', 
                letterSpacing: '-0.5px',
                color: todayRealizedPnl >= 0 ? '#00E676' : '#FF3B30'
              }}>
                {todayRealizedPnl >= 0 ? '+' : ''}{formatCurrency(todayRealizedPnl)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Closed Trades:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{todayTradesCount}</span>
              </div>
            </div>

          </div>

          {/* Asset Allocation & Breakdown Section */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1.2fr',
            gap: '16px'
          }}>
            
            {/* Left Box: Asset Allocation Donut Chart */}
            <div style={{
              background: 'linear-gradient(180deg, rgba(15, 32, 60, 0.6) 0%, rgba(11, 17, 33, 0.85) 100%)',
              backdropFilter: 'blur(16px)',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PieChartIcon size={16} style={{ color: '#38bdf8' }} />
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>Asset Allocation</h4>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Total: <strong style={{ color: 'var(--text-primary)' }}>{formatShortCurrency(totalInvested)}</strong>
                </span>
              </div>

              {/* Donut Chart Container */}
              <div style={{ width: '100%', height: '210px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={88}
                      paddingAngle={4}
                      dataKey="value"
                      isAnimationActive={true}
                      stroke="none"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val) => formatCurrency(val)}
                      contentStyle={{ 
                        background: 'rgba(11, 17, 33, 0.95)', 
                        border: '1px solid rgba(255, 255, 255, 0.15)', 
                        borderRadius: '10px',
                        backdropFilter: 'blur(12px)',
                        fontSize: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                      }}
                      itemStyle={{ color: '#FFFFFF', fontWeight: '600' }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Donut Label */}
                <div style={{
                  position: 'absolute',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Assets</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatShortCurrency(totalInvested)}</div>
                  <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '600' }}>100%</div>
                </div>
              </div>

              {/* Bottom Quick Legend */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                {[
                  { name: 'Stocks', color: '#3B82F6', val: totalInvestedStocks },
                  { name: 'ETFs', color: '#10B981', val: totalInvestedETFs },
                  { name: 'Derivatives', color: '#F59E0B', val: totalInvestedDerivatives },
                  { name: 'Mutual Funds', color: '#A855F7', val: totalInvestedMutualFunds }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{getAssetPct(item.val)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Box: Asset Distribution Details Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
              
              {/* Stocks Card */}
              <div style={{
                background: 'linear-gradient(145deg, rgba(15, 32, 60, 0.5) 0%, rgba(11, 17, 33, 0.7) 100%)',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3B82F6' }} />
                    <span style={{ fontWeight: '600', fontSize: '13px' }}>Stocks</span>
                  </div>
                  <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {getAssetPct(totalInvestedStocks)}%
                  </span>
                </div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: '#FFFFFF' }}>
                  {formatCurrency(totalInvestedStocks)}
                </div>
                {/* Progress bar */}
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${getAssetPct(totalInvestedStocks)}%`, height: '100%', background: '#3B82F6', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {countStocks} Position(s) Active
                </div>
              </div>

              {/* ETFs Card */}
              <div style={{
                background: 'linear-gradient(145deg, rgba(15, 32, 60, 0.5) 0%, rgba(11, 17, 33, 0.7) 100%)',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10B981' }} />
                    <span style={{ fontWeight: '600', fontSize: '13px' }}>ETFs</span>
                  </div>
                  <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {getAssetPct(totalInvestedETFs)}%
                  </span>
                </div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: '#FFFFFF' }}>
                  {formatCurrency(totalInvestedETFs)}
                </div>
                {/* Progress bar */}
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${getAssetPct(totalInvestedETFs)}%`, height: '100%', background: '#10B981', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {countETFs} ETF Scheme(s)
                </div>
              </div>

              {/* Derivatives Card */}
              <div style={{
                background: 'linear-gradient(145deg, rgba(15, 32, 60, 0.5) 0%, rgba(11, 17, 33, 0.7) 100%)',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#F59E0B' }} />
                    <span style={{ fontWeight: '600', fontSize: '13px' }}>Derivatives (F&O)</span>
                  </div>
                  <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {getAssetPct(totalInvestedDerivatives)}%
                  </span>
                </div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: '#FFFFFF' }}>
                  {formatCurrency(totalInvestedDerivatives)}
                </div>
                {/* Progress bar */}
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${getAssetPct(totalInvestedDerivatives)}%`, height: '100%', background: '#F59E0B', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {countDerivatives} Contract(s) Held
                </div>
              </div>

              {/* Mutual Funds Card */}
              <div style={{
                background: 'linear-gradient(145deg, rgba(15, 32, 60, 0.5) 0%, rgba(11, 17, 33, 0.7) 100%)',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#A855F7' }} />
                    <span style={{ fontWeight: '600', fontSize: '13px' }}>Mutual Funds</span>
                  </div>
                  <span style={{ fontSize: '11px', background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {getAssetPct(totalInvestedMutualFunds)}%
                  </span>
                </div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: '#FFFFFF' }}>
                  {formatCurrency(totalInvestedMutualFunds)}
                </div>
                {/* Progress bar */}
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${getAssetPct(totalInvestedMutualFunds)}%`, height: '100%', background: '#A855F7', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {countMutualFunds} Mutual Fund(s)
                </div>
              </div>

            </div>

          </div>

          {/* Holdings Section */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(15, 32, 60, 0.6) 0%, rgba(11, 17, 33, 0.85) 100%)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }}>
            
            {/* Holdings Header with Search & Filter Controls */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'center',
              gap: '12px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={17} style={{ color: '#38bdf8' }} /> Your Portfolio Holdings
                  <span style={{ fontSize: '11px', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {processedHoldings.length}
                  </span>
                </h3>
              </div>

              {/* Search & Filter Bar */}
              <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
                
                {/* Search Input */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '5px 10px',
                  flex: isMobile ? 1 : 'none'
                }}>
                  <Search size={13} style={{ color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search holdings..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                      width: isMobile ? '100%' : '140px'
                    }}
                  />
                </div>

                {/* Filter Pills */}
                <div style={{
                  display: 'flex',
                  background: 'rgba(0, 0, 0, 0.35)',
                  padding: '2px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  {[
                    { id: 'ALL', label: 'All' },
                    { id: 'PROFIT', label: 'Profit' },
                    { id: 'LOSS', label: 'Loss' }
                  ].map(f => {
                    const active = filterType === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFilterType(f.id)}
                        style={{
                          background: active ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                          color: active ? '#60a5fa' : 'var(--text-secondary)',
                          border: active ? '1px solid rgba(96, 165, 250, 0.4)' : '1px solid transparent',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: active ? '700' : '500',
                          cursor: 'pointer'
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                {/* Sort Selector */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    background: 'rgba(0, 0, 0, 0.35)',
                    color: 'var(--text-secondary)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="VALUE_DESC">Sort: Highest Value</option>
                  <option value="PNL_DESC">Sort: Highest P&L</option>
                  <option value="PNL_ASC">Sort: Lowest P&L</option>
                  <option value="NAME_ASC">Sort: Symbol A-Z</option>
                </select>

              </div>
            </div>

            {/* Holdings Table Content */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {isMobile ? (
                /* 📱 High-Density Mobile Holdings List */
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {processedHoldings.length > 0 ? (
                    processedHoldings.map((pos, idx) => {
                      const safeSymbol = pos.symbol || '';
                      return (
                        <div
                          key={pos.id || idx}
                          onClick={() => useStore.getState().openOrderModal(pos.symbol, 'SELL', pos.lotsize || 1, 'DEL', true, pos.quantity)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            cursor: 'pointer',
                            background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* Line 1: Exchange & Segment | Total P&L */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                              {safeSymbol.split(':')[0] || 'NSE'} • CNC
                            </span>
                            <div style={{ 
                              fontSize: '13px', 
                              fontWeight: '700', 
                              color: pos.isProfit ? '#00E676' : '#FF3B30' 
                            }}>
                              {pos.isProfit ? '+' : ''}{formatCurrency(pos.pnl)} ({pos.isProfit ? '+' : ''}{pos.pnlPct.toFixed(2)}%)
                            </div>
                          </div>

                          {/* Line 2: Symbol Name | Current Value */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                              {safeSymbol.split(':')[1] ? safeSymbol.split(':')[1].split('-')[0] : safeSymbol.split('-')[0]}
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                              {formatCurrency(pos.current)}
                            </div>
                          </div>

                          {/* Line 3: Qty & Avg Price | LTP & Sell button */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            <div>Qty: <strong style={{ color: 'var(--text-primary)' }}>{pos.qty}</strong> • Avg: ₹{parseFloat(pos.average_price).toFixed(2)}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>LTP: <strong style={{ color: '#38bdf8' }}>₹{pos.ltp.toFixed(2)}</strong></span>
                              <span style={{ 
                                fontSize: '10px', 
                                color: '#FF3B30', 
                                border: '1px solid rgba(255,59,48,0.3)', 
                                background: 'rgba(255,59,48,0.08)',
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                fontWeight: '700' 
                              }}>
                                SELL
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <Layers size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                      <div>No holdings matching your search or filter.</div>
                    </div>
                  )}
                </div>
              ) : (
                /* 🖥️ Modern Desktop Holdings Table */
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0, 0, 0, 0.25)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '14px 20px', fontWeight: '600' }}>Symbol</th>
                      <th style={{ padding: '14px 20px', fontWeight: '600', textAlign: 'right' }}>Qty</th>
                      <th style={{ padding: '14px 20px', fontWeight: '600', textAlign: 'right' }}>Avg Buy Price</th>
                      <th style={{ padding: '14px 20px', fontWeight: '600', textAlign: 'right' }}>Live LTP</th>
                      <th style={{ padding: '14px 20px', fontWeight: '600', textAlign: 'right' }}>Invested Value</th>
                      <th style={{ padding: '14px 20px', fontWeight: '600', textAlign: 'right' }}>Current Value</th>
                      <th style={{ padding: '14px 20px', fontWeight: '600', textAlign: 'right' }}>Total Return (P&L)</th>
                      <th style={{ padding: '14px 20px', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedHoldings.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Layers size={36} style={{ opacity: 0.3 }} />
                            <div style={{ fontSize: '14px', fontWeight: '600' }}>No Delivery Holdings Found</div>
                            <div style={{ fontSize: '12px', opacity: 0.7 }}>Buy delivery stocks to build and track your portfolio.</div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      processedHoldings.map((pos, idx) => {
                        const safeSymbol = pos.symbol || '';
                        return (
                          <tr 
                            key={pos.id || idx} 
                            style={{ 
                              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                              background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                              transition: 'background 0.15s ease'
                            }}
                          >
                            <td style={{ padding: '14px 20px', fontWeight: '700' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{safeSymbol.split(':')[1] ? safeSymbol.split(':')[1].split('-')[0] : safeSymbol.split('-')[0]}</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 5px', borderRadius: '4px', fontWeight: '600' }}>
                                  {safeSymbol.split(':')[0] || 'NSE'}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: '600' }}>{pos.qty}</td>
                            <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text-secondary)' }}>₹{parseFloat(pos.average_price).toFixed(2)}</td>
                            <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: '600', color: '#38bdf8' }}>₹{pos.ltp.toFixed(2)}</td>
                            <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(pos.invested)}</td>
                            <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(pos.current)}</td>
                            <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                              <div style={{ color: pos.isProfit ? '#00E676' : '#FF3B30', fontWeight: '700' }}>
                                {pos.isProfit ? '+' : ''}{formatCurrency(pos.pnl)}
                              </div>
                              <div style={{ fontSize: '11px', color: pos.isProfit ? '#00E676' : '#FF3B30', opacity: 0.85, fontWeight: '600' }}>
                                {pos.isProfit ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                              </div>
                            </td>
                            <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => useStore.getState().openOrderModal(pos.symbol, 'BUY', pos.lotsize || 1, 'DEL', false)}
                                  title="Buy More"
                                  style={{
                                    background: 'rgba(0, 230, 118, 0.1)',
                                    color: '#00E676',
                                    border: '1px solid rgba(0, 230, 118, 0.3)',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  + BUY
                                </button>
                                <button
                                  onClick={() => useStore.getState().openOrderModal(pos.symbol, 'SELL', pos.lotsize || 1, 'DEL', true, pos.quantity)}
                                  title="Exit / Sell"
                                  style={{
                                    background: 'rgba(255, 59, 48, 0.1)',
                                    color: '#FF3B30',
                                    border: '1px solid rgba(255, 59, 48, 0.3)',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  SELL
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}










