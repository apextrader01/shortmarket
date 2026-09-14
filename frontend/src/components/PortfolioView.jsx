import React, { useState, useMemo, useEffect, Suspense, lazy } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
const AnalyticsView = lazy(() => import('./AnalyticsView'));
import MutualFundDetailsModal from './MutualFundDetailsModal';
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

const EMPTY_PRICES = {};

export default function PortfolioView() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const containerRef = React.useRef(null);
  const [activeTab, setActiveTab] = useState('Overview');

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('VALUE_DESC'); // 'VALUE_DESC', 'PNL_DESC', 'PNL_ASC', 'NAME_ASC'
  const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'PROFIT', 'LOSS'
  const [assetFilter, setAssetFilter] = useState('ALL'); // 'ALL', 'EQUITY', 'MF'
  const [selectedMfFund, setSelectedMfFund] = useState(null);

  const [mfNames, setMfNames] = useState({
    'EDEL-MF': 'Edelweiss Balanced Advantage Fund - Direct Plan - Growth',
    'MIRA-MF': 'Mirae Asset Large Cap Fund - Direct Plan - Growth',
    'NIPP-MF': 'Nippon India Small Cap Fund - Direct Plan - Growth Option',
    '118615-MF': 'Edelweiss Balanced Advantage Fund - Direct Plan - Growth',
    '118825-MF': 'Mirae Asset Large Cap Fund - Direct Plan - Growth',
    '118778-MF': 'Nippon India Small Cap Fund - Direct Plan - Growth Option',
    '120197-MF': 'ICICI Prudential Liquid Fund - Direct Plan - Growth',
    '118615': 'Edelweiss Balanced Advantage Fund - Direct Plan - Growth',
    '118825': 'Mirae Asset Large Cap Fund - Direct Plan - Growth',
    '118778': 'Nippon India Small Cap Fund - Direct Plan - Growth Option',
    '120197': 'ICICI Prudential Liquid Fund - Direct Plan - Growth'
  });

  const isMutualFund = (sym, assetClass) => {
    if (assetClass === 'MUTUAL_FUND') return true;
    if (!sym || typeof sym !== 'string') return false;
    const clean = sym.includes(':') ? sym.split(':')[1] : sym;
    return clean.endsWith('-MF') || clean.includes('MUTUALFUND') || /^\d{5,6}$/.test(clean) || ['EDEL', 'MIRA', 'NIPP', 'EDEL-MF', 'MIRA-MF', 'NIPP-MF'].includes(clean);
  };

  const getMfName = (sym) => {
    if (!sym) return null;
    const clean = sym.includes(':') ? sym.split(':')[1] : sym;
    return mfNames[sym] || mfNames[clean] || mfNames[`${clean}-MF`] || mfNames[clean.replace('-MF', '')] || null;
  };

  const handleMfAction = (pos, mode = 'INVEST') => {
    const rawSym = pos.symbol || '';
    const cleanId = rawSym.replace('-MF', '').replace(/^(NSE:|BSE:|MCX:)/i, '');
    const fundName = getMfName(rawSym) || pos.name || cleanId;
    setSelectedMfFund({
      id: cleanId,
      schemeCode: cleanId,
      name: fundName,
      nav: pos.ltp || pos.average_price,
      symbol: rawSym,
      initialMode: mode
    });
  };

  const { positions, holdings, orders } = useStore(
    useShallow(state => ({ 
      positions: state.positions, 
      holdings: state.holdings, 
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

  // Merge T+1 holdings and T+0 open delivery positions
  const allMergedHoldingsMap = {};

  (holdings || []).forEach(h => {
    const sym = h.symbol;
    const cleanSym = (sym || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
    const key = cleanSym || sym;
    if (!allMergedHoldingsMap[key]) {
      allMergedHoldingsMap[key] = { ...h, quantity: Number(h.quantity) || 0, average_price: Number(h.average_price) || 0 };
    } else {
      const existing = allMergedHoldingsMap[key];
      const prevQty = Number(existing.quantity) || 0;
      const prevPrice = Number(existing.average_price) || 0;
      const addQty = Number(h.quantity) || 0;
      const addPrice = Number(h.average_price) || 0;
      const totalQty = prevQty + addQty;
      const weightedAvg = totalQty > 0 ? ((prevQty * prevPrice) + (addQty * addPrice)) / totalQty : 0;
      existing.quantity = totalQty;
      existing.average_price = weightedAvg;
    }
  });

  (positions || []).forEach(p => {
    const isDelivery = (p.product_type === 'DEL' || p.product_type === 'CNC' || p.product_type === 'DELIVERY');
    const isMF = (p.symbol?.endsWith('-MF') || p.symbol?.includes('MUTUALFUND') || p.asset_class === 'MUTUAL_FUND');
    if ((isDelivery || isMF) && Number(p.quantity) > 0) {
      const sym = p.symbol;
      const cleanSym = (sym || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
      const key = cleanSym || sym;
      if (!allMergedHoldingsMap[key]) {
        allMergedHoldingsMap[key] = { ...p, quantity: Number(p.quantity) || 0, average_price: Number(p.average_price) || 0, isT0: true };
      } else {
        const existing = allMergedHoldingsMap[key];
        const prevQty = Number(existing.quantity) || 0;
        const prevPrice = Number(existing.average_price) || 0;
        const addQty = Number(p.quantity) || 0;
        const addPrice = Number(p.average_price) || 0;
        const totalQty = prevQty + addQty;
        const weightedAvg = totalQty > 0 ? ((prevQty * prevPrice) + (addQty * addPrice)) / totalQty : 0;
        existing.quantity = totalQty;
        existing.average_price = weightedAvg;
      }
    }
  });

  const allMergedHoldings = Object.values(allMergedHoldingsMap).filter(h => h.quantity > 0);
  const deliveryPositions = allMergedHoldings;

  useEffect(() => {
    const symbols = (deliveryPositions || []).map(p => p.symbol).filter(s => isMutualFund(s));
    const unique = [...new Set(symbols)];
    const needed = unique.filter(s => !mfNames[s] && !mfNames[s.replace('-MF', '')]);
    if (needed.length === 0) return;

    fetch(`${API}/api/mf/names`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: needed })
    })
    .then(r => r.ok ? r.json() : {})
    .then(data => {
      setMfNames(prev => ({ ...prev, ...data }));
      needed.forEach(symbol => {
        if (!data[symbol]) {
          const cleanId = String(symbol).replace('-MF', '').replace(/^(NSE:|BSE:|MCX:)/i, '');
          fetch(`https://api.mfapi.in/mf/${cleanId}`)
            .then(r => r.json())
            .then(mfData => {
              if (mfData && mfData.meta && mfData.meta.scheme_name) {
                setMfNames(prev => ({ ...prev, [symbol]: mfData.meta.scheme_name }));
              }
            }).catch(() => {});
        }
      });
    })
    .catch(() => {});
  }, [deliveryPositions]);

  // ⚡ Performance: subscribe exclusively to prices of held assets
  const portfolioSymbols = useMemo(() => {
    const syms = new Set();
    (holdings || []).forEach(h => { if (h.symbol) syms.add(h.symbol); });
    (positions || []).forEach(p => { if (p.symbol) syms.add(p.symbol); });
    return Array.from(syms);
  }, [holdings, positions]);

  const portfolioPrices = useStore(
    useShallow(state => {
      if (portfolioSymbols.length === 0) return EMPTY_PRICES;
      const map = {};
      for (const sym of portfolioSymbols) {
        if (state.prices[sym]) map[sym] = state.prices[sym];
      }
      return map;
    })
  );

  const calculatePnL = (pos, isHolding = false) => {
    if (!pos) return;
    const cleanSym = (pos.symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
    const priceData = portfolioPrices[pos.symbol] 
      || portfolioPrices[cleanSym] 
      || portfolioPrices[`NSE:${cleanSym}`] 
      || portfolioPrices[`BSE:${cleanSym}`] 
      || portfolioPrices[`MCX:${cleanSym}`] 
      || {};
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
        symbolStr.includes('-MCX') || /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(cleanSym) ||
        /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(cleanSym) || cleanSym.endsWith('-FUT') ||
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
  (positions || []).filter(p => p.product_type !== 'DEL' && p.product_type !== 'CNC' && p.product_type !== 'DELIVERY').forEach(p => calculatePnL(p, false));

  const getISTDate = (date) => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  };

  const isToday = (dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return false;
    return getISTDate(d) === getISTDate(new Date());
  };

  let todayRealizedPnl = 0;
  let todayTradesCount = 0;
  if (orders) {
    orders.forEach(o => {
      const isExecuted = o.status === 'EXECUTED' || o.status === 'COMPLETED' || o.status === 'COMPLETE';
      if (isExecuted && o.realized_pnl !== null && o.realized_pnl !== undefined && isToday(o.updated_at || o.created_at)) {
        todayRealizedPnl += parseFloat(o.realized_pnl);
        todayTradesCount++;
      }
    });
  }

  const overallGain = totalCurrent - totalInvested;
  const overallPct = totalInvested > 0 ? (overallGain / totalInvested) * 100 : 0;
  const isGain = overallGain >= 0;

  // Chart Data for Asset Allocation (Memoized to prevent unnecessary Recharts redraws)
  const chartData = useMemo(() => {
    const data = [
      { name: 'Stocks', value: totalInvestedStocks, color: '#3B82F6', count: countStocks },
      { name: 'ETFs', value: totalInvestedETFs, color: '#10B981', count: countETFs },
      { name: 'Derivatives', value: totalInvestedDerivatives, color: '#F59E0B', count: countDerivatives },
      { name: 'Mutual Funds', value: totalInvestedMutualFunds, color: '#A855F7', count: countMutualFunds }
    ].filter(d => d.value > 0);
    
    if (data.length === 0) {
      data.push({ name: 'Unallocated Cash', value: 100, color: 'rgba(255, 255, 255, 0.1)', count: 0 });
    }
    return data;
  }, [totalInvestedStocks, totalInvestedETFs, totalInvestedDerivatives, totalInvestedMutualFunds, countStocks, countETFs, countDerivatives, countMutualFunds]);

  // Filter & Sort Holdings
  const processedHoldings = useMemo(() => {
    let list = deliveryPositions.map(pos => {
      const priceData = portfolioPrices[pos.symbol] || {};
      const ltp = priceData.ltp || parseFloat(pos.average_price) || 0;
      const chg = priceData.chg !== undefined && priceData.chg !== null ? priceData.chg : 0;
      const chgp = priceData.chgp !== undefined && priceData.chgp !== null ? priceData.chgp : 0;
      const qty = Math.abs(pos.quantity);
      const invested = parseFloat(pos.average_price) * qty;
      const current = ltp * qty;
      const pnl = current - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
      const dayChangeVal = chg * qty;
      const isMf = isMutualFund(pos.symbol, pos.asset_class);
      const displayName = isMf 
        ? (getMfName(pos.symbol) || (pos.symbol || '').replace('-MF', ''))
        : (pos.symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '').split('-')[0];
      return {
        ...pos,
        ltp,
        chg,
        chgp,
        dayChangeVal,
        qty,
        invested,
        current,
        pnl,
        pnlPct,
        isProfit: pnl >= 0,
        isMf,
        displayName
      };
    });

    // Asset segment filter
    if (assetFilter === 'EQUITY') {
      list = list.filter(p => !p.isMf);
    } else if (assetFilter === 'MF') {
      list = list.filter(p => p.isMf);
    }

    // Search filter
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      list = list.filter(p => 
        (p.symbol || '').toLowerCase().includes(query) ||
        (p.displayName || '').toLowerCase().includes(query)
      );
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
      if (sortBy === 'NAME_ASC') return (a.displayName || a.symbol || '').localeCompare(b.displayName || b.symbol || '');
      return 0;
    });

    return list;
  }, [deliveryPositions, portfolioPrices, searchTerm, filterType, assetFilter, sortBy, mfNames]);

  // Asset percentage helper
  const getAssetPct = (val) => {
    if (totalInvested <= 0) return '0.0';
    return ((val / totalInvested) * 100).toFixed(1);
  };

  return (
    <div 
      ref={containerRef}
      style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        background: 'var(--bg-dark)', 
        width: '100%', 
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        overflowY: 'auto', 
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        boxSizing: 'border-box',
        position: 'relative'
      }}>
      
      {/* Sub Navigation Bar - Sticky at Top */}
      <div style={{ 
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: isMobile ? '0 16px' : '0 28px', 
        borderBottom: '1px solid var(--border-color)', 
        background: '#0d1527',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
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
                onClick={() => handleTabClick(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 2px',
                  fontSize: '13.5px',
                  fontWeight: active ? '700' : '500',
                  color: active ? '#2563eb' : 'var(--text-secondary)',
                  borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} style={{ color: active ? '#2563eb' : 'var(--text-secondary)' }} />
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
            background: 'var(--bg-card)',
            padding: '6px 14px',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
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
        <div style={{ padding: isMobile ? '12px' : '24px', paddingBottom: '100px' }}>
          <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading analytics...</div>}>
            <AnalyticsView />
          </Suspense>
        </div>
      ) : (
        <div style={{ padding: isMobile ? '14px' : '24px', paddingBottom: '120px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Top 4 Key Metric Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', 
            gap: isMobile ? '12px' : '16px' 
          }}>
            
            {/* Card 1: Total Portfolio Current Value */}
            <div className="glass-panel" style={{
              padding: isMobile ? '14px' : '18px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-panel)',
              boxShadow: 'var(--card-shadow, 0 4px 20px rgba(0,0,0,0.08))',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wallet size={14} style={{ color: '#2563eb' }} />
                  </div>
                  <span>Current Worth</span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                  PORTFOLIO
                </span>
              </div>
              <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: '700', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
                {formatCurrency(totalCurrent)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Invested:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatCurrency(totalInvested)}</span>
              </div>
            </div>

            {/* Card 2: Overall Gain / Return */}
            <div className="glass-panel" style={{
              padding: isMobile ? '14px' : '18px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-panel)',
              boxShadow: 'var(--card-shadow, 0 4px 20px rgba(0,0,0,0.08))',
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
                color: isGain ? '#00E676' : '#FF3B30'
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
            <div className="glass-panel" style={{
              padding: isMobile ? '14px' : '18px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-panel)',
              boxShadow: 'var(--card-shadow, 0 4px 20px rgba(0,0,0,0.08))',
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
                color: unrealizedPnl >= 0 ? '#00E676' : '#FF3B30'
              }}>
                {unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(unrealizedPnl)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                All Open Positions
              </div>
            </div>

            {/* Card 4: Today's Realized P&L */}
            <div className="glass-panel" style={{
              padding: isMobile ? '14px' : '18px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-panel)',
              boxShadow: 'var(--card-shadow, 0 4px 20px rgba(0,0,0,0.08))',
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
            <div className="glass-panel" style={{
              background: 'var(--bg-panel)',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--card-shadow, 0 8px 32px rgba(0, 0, 0, 0.08))',
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
                      isAnimationActive={false}
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
              <div className="glass-panel" style={{
                background: 'var(--bg-panel)',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
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
                  <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {getAssetPct(totalInvestedStocks)}%
                  </span>
                </div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {formatCurrency(totalInvestedStocks)}
                </div>
                {/* Progress bar */}
                <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${getAssetPct(totalInvestedStocks)}%`, height: '100%', background: '#3B82F6', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {countStocks} Position(s) Active
                </div>
              </div>

              {/* ETFs Card */}
              <div className="glass-panel" style={{
                background: 'var(--bg-panel)',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
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
                  <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {getAssetPct(totalInvestedETFs)}%
                  </span>
                </div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {formatCurrency(totalInvestedETFs)}
                </div>
                {/* Progress bar */}
                <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${getAssetPct(totalInvestedETFs)}%`, height: '100%', background: '#10B981', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {countETFs} ETF Scheme(s)
                </div>
              </div>

              {/* Derivatives Card */}
              <div className="glass-panel" style={{
                background: 'var(--bg-panel)',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
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
                  <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {getAssetPct(totalInvestedDerivatives)}%
                  </span>
                </div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {formatCurrency(totalInvestedDerivatives)}
                </div>
                {/* Progress bar */}
                <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${getAssetPct(totalInvestedDerivatives)}%`, height: '100%', background: '#F59E0B', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {countDerivatives} Contract(s) Held
                </div>
              </div>

              {/* Mutual Funds Card */}
              <div className="glass-panel" style={{
                background: 'var(--bg-panel)',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
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
                  <span style={{ fontSize: '11px', background: 'rgba(168, 85, 247, 0.12)', color: '#9333ea', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {getAssetPct(totalInvestedMutualFunds)}%
                  </span>
                </div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {formatCurrency(totalInvestedMutualFunds)}
                </div>
                {/* Progress bar */}
                <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${getAssetPct(totalInvestedMutualFunds)}%`, height: '100%', background: '#A855F7', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {countMutualFunds} Mutual Fund(s)
                </div>
              </div>

            </div>

          </div>

          {/* Holdings Section */}
          <div className="glass-panel" style={{
            background: 'var(--bg-panel)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--card-shadow, 0 8px 32px rgba(0, 0, 0, 0.08))',
            overflow: 'hidden'
          }}>
            
            {/* Holdings Header with Search & Filter Controls */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'center',
              gap: '12px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={17} style={{ color: '#2563eb' }} /> Your Portfolio Holdings
                  <span style={{ fontSize: '11px', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>
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
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
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

                {/* Asset Segment Filter Pills */}
                <div style={{
                  display: 'flex',
                  background: 'var(--bg-card)',
                  padding: '2px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  {[
                    { id: 'ALL', label: 'All Assets' },
                    { id: 'EQUITY', label: 'Stocks' },
                    { id: 'MF', label: 'Mutual Funds' }
                  ].map(a => {
                    const active = assetFilter === a.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setAssetFilter(a.id)}
                        style={{
                          background: active ? '#2563eb' : 'transparent',
                          color: active ? '#ffffff' : 'var(--text-secondary)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: active ? '700' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>

                {/* Filter Pills */}
                <div style={{
                  display: 'flex',
                  background: 'var(--bg-card)',
                  padding: '2px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
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
                          background: active ? '#2563eb' : 'transparent',
                          color: active ? '#ffffff' : 'var(--text-secondary)',
                          border: 'none',
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
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
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
                          onClick={() => {
                            if (pos.isMf) {
                              handleMfAction(pos, 'REDEEM');
                            } else {
                              useStore.getState().openOrderModal(pos.symbol, 'SELL', pos.lotSize || pos.lotsize || 1, 'DEL', true, pos.quantity);
                            }
                          }}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            cursor: 'pointer',
                            background: idx % 2 === 0 ? 'var(--bg-card)' : 'transparent',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* Line 1: Exchange & Segment | Total P&L */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {pos.isMf ? (
                              <span style={{ fontSize: '10px', color: '#a855f7', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                MUTUAL FUND
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                {safeSymbol.split(':')[0] || 'NSE'} • CNC
                              </span>
                            )}
                            <div style={{ 
                              fontSize: '13px', 
                              fontWeight: '700', 
                              color: pos.isProfit ? '#00E676' : '#FF3B30' 
                            }}>
                              {pos.isProfit ? '+' : ''}{formatCurrency(pos.pnl)} ({pos.isProfit ? '+' : ''}{pos.pnlPct.toFixed(2)}%)
                            </div>
                          </div>

                          {/* Line 2: Symbol Name | Current Value */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1.3' }}>
                              {pos.displayName || safeSymbol}
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {formatCurrency(pos.current)}
                            </div>
                          </div>

                          {/* Line 3: Qty & Avg Price | LTP/NAV & Sell/Redeem button */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            <div>{pos.isMf ? 'Units' : 'Qty'}: <strong style={{ color: 'var(--text-primary)' }}>{pos.isMf ? Number(pos.qty).toFixed(4) : pos.qty}</strong> • Avg: ₹{parseFloat(pos.average_price).toFixed(2)}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{pos.isMf ? 'NAV' : 'LTP'}: <strong style={{ color: '#2563eb' }}>₹{pos.ltp.toFixed(2)}</strong></span>
                              {!pos.isMf && (
                                <span style={{ fontSize: '10px', color: (pos.chgp || 0) >= 0 ? '#00E676' : '#FF3B30', fontWeight: '600' }}>
                                  {(pos.chgp || 0) >= 0 ? '+' : ''}{(pos.chgp || 0).toFixed(2)}%
                                </span>
                              )}
                              <span style={{ 
                                fontSize: '10px', 
                                color: pos.isMf ? '#a855f7' : '#FF3B30', 
                                border: `1px solid ${pos.isMf ? 'rgba(168,85,247,0.3)' : 'rgba(255,59,48,0.3)'}`, 
                                background: pos.isMf ? 'rgba(168,85,247,0.08)' : 'rgba(255,59,48,0.08)',
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                fontWeight: '700' 
                              }}>
                                {pos.isMf ? 'REDEEM' : 'SELL'}
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
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 14px', fontWeight: '600' }}>Symbol / Scheme</th>
                      <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'right' }}>Qty / Units</th>
                      <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'right' }}>Avg Buy Price</th>
                      <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'right' }}>Live LTP / NAV</th>
                      <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'right' }}>Day Change</th>
                      <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'right' }}>Invested Value</th>
                      <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'right' }}>Current Value</th>
                      <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'right' }}>Total Return (P&L)</th>
                      <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedHoldings.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Layers size={36} style={{ opacity: 0.3 }} />
                            <div style={{ fontSize: '14px', fontWeight: '600' }}>No Delivery Holdings Found</div>
                            <div style={{ fontSize: '12px', opacity: 0.7 }}>Buy delivery stocks or invest in mutual funds to build and track your portfolio.</div>
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
                              borderBottom: '1px solid var(--border-color)',
                              background: idx % 2 === 0 ? 'var(--bg-card)' : 'transparent',
                              transition: 'background 0.15s ease'
                            }}
                          >
                            <td style={{ padding: '12px 14px', fontWeight: '700' }}>
                              {pos.isMf ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--text-primary)', fontSize: '13.5px' }}>{pos.displayName}</span>
                                    <span style={{ fontSize: '10px', color: '#a855f7', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                      MUTUAL FUND
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                                    Code: {safeSymbol}
                                  </span>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ color: 'var(--text-primary)' }}>{safeSymbol.split(':')[1] ? safeSymbol.split(':')[1].split('-')[0] : safeSymbol.split('-')[0]}</span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '2px 5px', borderRadius: '4px', fontWeight: '600' }}>
                                    {safeSymbol.split(':')[0] || 'NSE'}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)' }}>
                              {pos.isMf ? Number(pos.qty).toFixed(4) : pos.qty}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>₹{(parseFloat(pos.average_price) || 0).toFixed(2)}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600', color: '#2563eb' }}>₹{(parseFloat(pos.ltp) || 0).toFixed(2)}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              {pos.isMf ? (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>
                                  Daily NAV
                                </div>
                              ) : (
                                <>
                                  <div style={{ color: (pos.chg || 0) >= 0 ? '#00E676' : '#FF3B30', fontWeight: '600' }}>
                                    {(pos.chg || 0) >= 0 ? '+' : ''}₹{(pos.chg || 0).toFixed(2)}
                                  </div>
                                  <div style={{ fontSize: '11px', color: (pos.chgp || 0) >= 0 ? '#00E676' : '#FF3B30', opacity: 0.85, fontWeight: '600' }}>
                                    {(pos.chgp || 0) >= 0 ? '+' : ''}{(pos.chgp || 0).toFixed(2)}%
                                  </div>
                                </>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(pos.invested)}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(pos.current)}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <div style={{ color: pos.isProfit ? '#00E676' : '#FF3B30', fontWeight: '700' }}>
                                {pos.isProfit ? '+' : ''}{formatCurrency(pos.pnl)}
                              </div>
                              <div style={{ fontSize: '11px', color: pos.isProfit ? '#00E676' : '#FF3B30', opacity: 0.85, fontWeight: '600' }}>
                                {pos.isProfit ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                {pos.isMf ? (
                                  <>
                                    <button
                                      onClick={() => handleMfAction(pos, 'INVEST')}
                                      title="Invest More in Fund"
                                      style={{
                                        background: 'rgba(168, 85, 247, 0.1)',
                                        color: '#a855f7',
                                        border: '1px solid rgba(168, 85, 247, 0.3)',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      + INVEST
                                    </button>
                                    <button
                                      onClick={() => handleMfAction(pos, 'REDEEM')}
                                      title="Redeem Units"
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
                                      REDEEM
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => useStore.getState().openOrderModal(pos.symbol, 'BUY', pos.lotSize || pos.lotsize || 1, 'DEL', false)}
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
                                      onClick={() => useStore.getState().openOrderModal(pos.symbol, 'SELL', pos.lotSize || pos.lotsize || 1, 'DEL', true, pos.quantity)}
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
                                  </>
                                )}
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

      {selectedMfFund && (
        <MutualFundDetailsModal 
          fund={selectedMfFund} 
          onClose={() => setSelectedMfFund(null)} 
        />
      )}
    </div>
  );
}










