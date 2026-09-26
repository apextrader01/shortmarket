import React, { useState, useMemo, useEffect, useRef, Suspense, lazy } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
const AnalyticsView = lazy(() => import('./AnalyticsView'));
const TradingJournalView = lazy(() => import('./TradingJournalView'));
import MutualFundDetailsModal from './MutualFundDetailsModal';
import { getTodayRealizedMetrics } from '../utils/pnlHelper';
import { 
  Briefcase, 
  BarChart3, 
  CalendarDays,
  BookOpen,
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
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
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
  const [showAssetBreakdown, setShowAssetBreakdown] = useState(false);

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

  const COMMODITIES_LIST = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'];

  const isDerivativeContract = (sym) => {
    if (!sym || typeof sym !== 'string') return false;
    if (sym.startsWith('MCX:') || sym.includes('-MCX') || sym.includes('NCDEX')) return true;
    const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '').trim();
    if (/(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean)) return true;
    if (/(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || clean.endsWith('-FUT')) return true;
    if (COMMODITIES_LIST.some(c => clean.startsWith(c))) return true;
    return false;
  };

  const getAssetCategoryOrder = (item) => {
    const sym = typeof item === 'string' ? item : (item?.symbol || '');
    const assetClass = item?.asset_class || '';
    if (isMutualFund(sym, assetClass) || item?.isMf) return 3; // Mutual Funds (last)
    if (isDerivativeContract(sym) || assetClass === 'DERIVATIVE' || assetClass === 'COMMODITY') return 2; // Derivatives (middle)
    return 1; // Stocks & ETFs (first)
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

  const {
    deliveryPositions,
    totalInvested,
    totalCurrent,
    totalInvestedStocks,
    totalInvestedETFs,
    totalInvestedDerivatives,
    totalInvestedMutualFunds,
    countStocks,
    countETFs,
    countDerivatives,
    countMutualFunds,
    unrealizedPnl
  } = useMemo(() => {
    let investedSum = 0;
    let currentSum = 0;
    let invStocks = 0;
    let invETFs = 0;
    let invDerivatives = 0;
    let invMF = 0;
    let cntStocks = 0;
    let cntETFs = 0;
    let cntDeriv = 0;
    let cntMF = 0;
    let uPnl = 0;

    // Merge T+1 holdings and T+0 open delivery positions
    const allMergedHoldingsMap = {};

    (holdings || []).forEach(h => {
      if (!h) return;
      const sym = h.symbol;
      const cleanSym = (sym || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
      const key = cleanSym || sym;
      const hQty = Number(h.quantity) || 0;
      const hPrice = Math.abs(Number(h.average_price) || 0);
      if (hQty <= 0) return;

      if (!allMergedHoldingsMap[key]) {
        allMergedHoldingsMap[key] = { 
          ...h, 
          quantity: hQty, 
          average_price: hPrice,
          side: h.side || (hQty < 0 ? 'SELL' : 'BUY')
        };
      } else {
        const existing = allMergedHoldingsMap[key];
        const prevQty = Number(existing.quantity) || 0;
        const prevPrice = Math.abs(Number(existing.average_price) || 0);
        const totalQty = prevQty + hQty;
        const totalCost = (Math.abs(prevQty) * prevPrice) + (Math.abs(hQty) * hPrice);
        const absTotalQty = Math.abs(totalQty);
        const weightedAvg = absTotalQty > 0 ? (totalCost / absTotalQty) : prevPrice;
        existing.quantity = totalQty;
        existing.average_price = Math.abs(weightedAvg);
        existing.side = totalQty < 0 ? 'SELL' : 'BUY';
      }
    });

    (positions || []).forEach(p => {
      const isDelivery = (p.product_type === 'DEL' || p.product_type === 'CNC' || p.product_type === 'DELIVERY');
      const isMF = (p.symbol?.endsWith('-MF') || p.symbol?.includes('MUTUALFUND') || p.asset_class === 'MUTUAL_FUND');
      if ((isDelivery || isMF) && Math.abs(Number(p.quantity)) > 0) {
        const sym = p.symbol;
        const cleanSym = (sym || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
        const key = cleanSym || sym;
        const pQty = Number(p.quantity) || 0;
        const pPrice = Math.abs(Number(p.average_price) || 0);
        if (!allMergedHoldingsMap[key]) {
          allMergedHoldingsMap[key] = { 
            ...p, 
            quantity: pQty, 
            average_price: pPrice, 
            side: p.side || (pQty < 0 ? 'SELL' : 'BUY'),
            isT0: true 
          };
        } else {
          const existing = allMergedHoldingsMap[key];
          const prevQty = Number(existing.quantity) || 0;
          const prevPrice = Math.abs(Number(existing.average_price) || 0);
          const totalQty = prevQty + pQty;
          const totalCost = (Math.abs(prevQty) * prevPrice) + (Math.abs(pQty) * pPrice);
          const absTotalQty = Math.abs(totalQty);
          const weightedAvg = absTotalQty !== 0 ? (totalCost / absTotalQty) : prevPrice;
          existing.quantity = totalQty;
          existing.average_price = Math.abs(weightedAvg);
          existing.side = totalQty < 0 ? 'SELL' : 'BUY';
        }
      }
    });

    const allMergedHoldings = Object.values(allMergedHoldingsMap).filter(h => Math.abs(Number(h.quantity)) > 0);

    const calcPosPnL = (pos, isHolding = false) => {
      if (!pos) return;
      const cleanSym = (pos.symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
      const priceData = portfolioPrices[pos.symbol] 
        || portfolioPrices[cleanSym] 
        || portfolioPrices[`NSE:${cleanSym}`] 
        || portfolioPrices[`BSE:${cleanSym}`] 
        || portfolioPrices[`MCX:${cleanSym}`] 
        || {};
      const avg = Math.abs(parseFloat(pos.average_price) || 0);
      const ltp = (typeof priceData.ltp === 'number' && priceData.ltp > 0) ? priceData.ltp : avg;
      const qty = Math.abs(Number(pos.quantity) || 0);
      const isShort = Number(pos.quantity) < 0 || pos.side === 'SELL';
      
      const invested = avg * qty;
      const current = ltp * qty;
      
      let pnl = 0;
      if (isShort) {
        pnl = invested - current;
      } else {
        pnl = current - invested;
      }
      uPnl += pnl;

      // For portfolio breakdown, ONLY include T+1 Holdings (Condition 8)
      if (isHolding) {
        investedSum += invested;
        currentSum += current;

        const symbolStr = pos.symbol || '';
        const cleanSymbolStr = symbolStr.replace(/^(NSE:|BSE:|MCX:)/i, '');
        
        if (symbolStr.includes('ETF') || symbolStr.includes('BEES') || symbolStr.includes('LIQUID')) {
          invETFs += invested;
          cntETFs++;
        } else if (symbolStr.includes('-MF') || symbolStr.includes('MUTUALFUND')) {
          invMF += invested;
          cntMF++;
        } else if (
          symbolStr.includes('-MCX') || /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(cleanSymbolStr) ||
          /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(cleanSymbolStr) || cleanSymbolStr.endsWith('-FUT') ||
          ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'].some(c => cleanSymbolStr.startsWith(c))
        ) {
          invDerivatives += invested;
          cntDeriv++;
        } else {
          invStocks += invested;
          cntStocks++;
        }
      }
    };

    allMergedHoldings.forEach(h => calcPosPnL(h, true));
    (positions || []).filter(p => p.product_type !== 'DEL' && p.product_type !== 'CNC' && p.product_type !== 'DELIVERY').forEach(p => calcPosPnL(p, false));

    return {
      deliveryPositions: allMergedHoldings,
      totalInvested: investedSum,
      totalCurrent: currentSum,
      totalInvestedStocks: invStocks,
      totalInvestedETFs: invETFs,
      totalInvestedDerivatives: invDerivatives,
      totalInvestedMutualFunds: invMF,
      countStocks: cntStocks,
      countETFs: cntETFs,
      countDerivatives: cntDeriv,
      countMutualFunds: cntMF,
      unrealizedPnl: uPnl
    };
  }, [holdings, positions, portfolioPrices]);

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

  // ⚡ Performance: IST date comparisons use timeZone: 'Asia/Kolkata' via getTodayRealizedMetrics
  const { todayRealizedPnl, todayTradesCount } = useMemo(() => {
    return getTodayRealizedMetrics(positions, orders);
  }, [positions, orders]);

  const overallGain = unrealizedPnl;
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
      const avg = Math.abs(parseFloat(pos.average_price) || 0);
      const ltp = (typeof priceData.ltp === 'number' && priceData.ltp > 0) ? priceData.ltp : avg;
      const chg = priceData.chg !== undefined && priceData.chg !== null ? priceData.chg : 0;
      const chgp = priceData.chgp !== undefined && priceData.chgp !== null ? priceData.chgp : 0;
      const qty = Math.abs(pos.quantity);
      const isShort = Number(pos.quantity) < 0 || pos.side === 'SELL';
      const invested = avg * qty;
      const current = ltp * qty;
      const pnl = isShort ? (invested - current) : (current - invested);
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
      const dayChangeVal = (isShort ? -chg : chg) * qty;
      const isMf = isMutualFund(pos.symbol, pos.asset_class);
      const displayName = isMf 
        ? (getMfName(pos.symbol) || (pos.symbol || '').replace('-MF', ''))
        : (pos.symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '').split('-')[0];
      return {
        ...pos,
        average_price: avg,
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
        isShort,
        isMf,
        displayName
      };
    });

    // Asset segment filter
    if (assetFilter === 'EQUITY') {
      list = list.filter(p => !p.isMf && !isDerivativeContract(p.symbol));
    } else if (assetFilter === 'DERIVATIVES') {
      list = list.filter(p => !p.isMf && isDerivativeContract(p.symbol));
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

    // Sorting: Primary sort is Category (1. Stocks -> 2. Derivatives -> 3. Mutual Funds)
    list.sort((a, b) => {
      const orderA = getAssetCategoryOrder(a);
      const orderB = getAssetCategoryOrder(b);
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      if (sortBy === 'VALUE_DESC') return (b.current || 0) - (a.current || 0);
      if (sortBy === 'PNL_DESC') return (b.pnl || 0) - (a.pnl || 0);
      if (sortBy === 'PNL_ASC') return (a.pnl || 0) - (b.pnl || 0);
      if (sortBy === 'NAME_ASC') return (a.displayName || a.symbol || '').localeCompare(b.displayName || b.symbol || '');
      return (b.current || 0) - (a.current || 0);
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
        padding: isMobile ? '0 12px' : '0 20px', 
        height: isMobile ? '44px' : '48px',
        borderBottom: '1px solid var(--border-color)', 
        background: '#0d1527',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: isMobile ? '12px' : '20px', height: '100%', alignItems: 'stretch', overflowX: isMobile ? 'auto' : 'visible' }}>
          {[
            { id: 'Overview', label: 'Portfolio Overview', icon: Briefcase },
            { id: 'Analytics', label: 'Trade Analytics', icon: BarChart3 },
            { id: 'Heatmap', label: 'P&L Calendar Heatmap', icon: CalendarDays },
            { id: 'Journal', label: 'Trade Journal Log', icon: BookOpen }
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
                  gap: '7px',
                  padding: isMobile ? '0 4px' : '0 6px',
                  height: '100%',
                  boxSizing: 'border-box',
                  fontSize: isMobile ? '12px' : '13px',
                  fontWeight: active ? '700' : '500',
                  color: active ? '#2563eb' : 'var(--text-secondary)',
                  borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                  marginBottom: '-1px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                <Icon size={15} style={{ color: active ? '#2563eb' : 'var(--text-secondary)' }} />
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
      ) : activeTab === 'Heatmap' ? (
        <div style={{ padding: isMobile ? '12px' : '20px', paddingBottom: '100px' }}>
          <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading calendar heatmap...</div>}>
            <TradingJournalView mode="CALENDAR" />
          </Suspense>
        </div>
      ) : activeTab === 'Journal' ? (
        <div style={{ padding: isMobile ? '12px' : '20px', paddingBottom: '100px' }}>
          <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading trade journal log...</div>}>
            <TradingJournalView mode="JOURNAL" />
          </Suspense>
        </div>
      ) : (
        <div style={{ padding: isMobile ? '10px 12px 100px' : '16px 20px 100px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* Top 4 Key Metric Cards (Optimized High-Density Layout) */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', 
            gap: isMobile ? '8px' : '10px' 
          }}>
            
            {/* Card 1: Total Portfolio Current Value */}
            <div className="glass-panel" style={{
              padding: isMobile ? '8px 10px' : '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-panel)',
              boxShadow: 'var(--card-shadow, 0 2px 10px rgba(0,0,0,0.06))',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: '500' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wallet size={13} style={{ color: '#2563eb' }} />
                  </div>
                  <span>Current Worth</span>
                </div>
                <span style={{ fontSize: '9.5px', fontWeight: '700', padding: '1px 5px', borderRadius: '3px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                  PORTFOLIO
                </span>
              </div>
              <div style={{ fontSize: isMobile ? '16px' : '19px', fontWeight: '700', letterSpacing: '-0.3px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(totalCurrent)}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '3px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Invested:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalInvested)}</span>
              </div>
            </div>

            {/* Card 2: Overall Gain / Return */}
            <div className="glass-panel" style={{
              padding: isMobile ? '8px 10px' : '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-panel)',
              boxShadow: 'var(--card-shadow, 0 2px 10px rgba(0,0,0,0.06))',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: '500' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: isGain ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 59, 48, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={13} style={{ color: isGain ? '#00E676' : '#FF3B30' }} />
                  </div>
                  <span>Total Return</span>
                </div>
                <span style={{ 
                  fontSize: '9.5px', 
                  fontWeight: '700', 
                  padding: '1px 5px', 
                  borderRadius: '3px', 
                  background: isGain ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 59, 48, 0.12)', 
                  color: isGain ? '#00E676' : '#FF3B30' 
                }}>
                  {isGain ? 'GAIN' : 'LOSS'}
                </span>
              </div>
              <div style={{ 
                fontSize: isMobile ? '16px' : '19px', 
                fontWeight: '700', 
                letterSpacing: '-0.3px', 
                color: isGain ? '#00E676' : '#FF3B30',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {isGain ? '+' : ''}{formatCurrency(overallGain)}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '3px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Return ROI:</span>
                <span style={{ color: isGain ? '#00E676' : '#FF3B30', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                  {isGain ? '+' : ''}{overallPct.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Card 3: Unrealized P&L (Live) */}
            <div className="glass-panel" style={{
              padding: isMobile ? '8px 10px' : '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-panel)',
              boxShadow: 'var(--card-shadow, 0 2px 10px rgba(0,0,0,0.06))',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: '500' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: unrealizedPnl >= 0 ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 59, 48, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unrealizedPnl >= 0 ? <TrendingUp size={13} style={{ color: '#00E676' }} /> : <TrendingDown size={13} style={{ color: '#FF3B30' }} />}
                  </div>
                  <span>Unrealized P&L</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', fontWeight: '700', padding: '1px 5px', borderRadius: '3px', background: 'rgba(234, 179, 8, 0.12)', color: '#EAB308' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00E676', display: 'inline-block' }} />
                  LIVE
                </span>
              </div>
              <div style={{ 
                fontSize: isMobile ? '16px' : '19px', 
                fontWeight: '700', 
                letterSpacing: '-0.3px', 
                color: unrealizedPnl >= 0 ? '#00E676' : '#FF3B30',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(unrealizedPnl)}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                All Open Positions
              </div>
            </div>

            {/* Card 4: Today's Realized P&L */}
            <div className="glass-panel" style={{
              padding: isMobile ? '8px 10px' : '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-panel)',
              boxShadow: 'var(--card-shadow, 0 2px 10px rgba(0,0,0,0.06))',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: '500' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Coins size={13} style={{ color: '#c084fc' }} />
                  </div>
                  <span>Today's Realized</span>
                </div>
                <span style={{ fontSize: '9.5px', fontWeight: '700', padding: '1px 5px', borderRadius: '3px', background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' }}>
                  BOOKED
                </span>
              </div>
              <div style={{ 
                fontSize: isMobile ? '16px' : '19px', 
                fontWeight: '700', 
                letterSpacing: '-0.3px', 
                color: todayRealizedPnl >= 0 ? '#00E676' : '#FF3B30',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {todayRealizedPnl >= 0 ? '+' : ''}{formatCurrency(todayRealizedPnl)}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '3px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Closed Trades:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{todayTradesCount}</span>
              </div>
            </div>

          </div>

          {/* Asset Allocation & Breakdown Section (Collapsible) */}
          <div className="glass-panel" style={{
            background: 'var(--bg-panel)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            boxShadow: 'var(--card-shadow, 0 4px 16px rgba(0, 0, 0, 0.08))'
          }}>
            {/* Header toggle bar */}
            <div 
              onClick={() => setShowAssetBreakdown(!showAssetBreakdown)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: isMobile ? '9px 12px' : '10px 18px',
                cursor: 'pointer',
                background: showAssetBreakdown ? 'rgba(255,255,255,0.03)' : 'transparent',
                userSelect: 'none',
                transition: 'background 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieChartIcon size={15} style={{ color: '#38bdf8' }} />
                <span style={{ fontSize: isMobile ? '12.5px' : '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>Asset Allocation & Distribution</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: isMobile ? 'none' : 'inline' }}>
                  (Total: <strong style={{ color: 'var(--text-primary)' }}>{formatShortCurrency(totalInvested)}</strong>)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Summary badge pills */}
                {!isMobile && (
                  <div style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
                    <span style={{ color: '#3B82F6', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 7px', borderRadius: '4px', fontWeight: '600' }}>
                      Stocks {getAssetPct(totalInvestedStocks)}%
                    </span>
                    <span style={{ color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 7px', borderRadius: '4px', fontWeight: '600' }}>
                      ETFs {getAssetPct(totalInvestedETFs)}%
                    </span>
                    <span style={{ color: '#F59E0B', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 7px', borderRadius: '4px', fontWeight: '600' }}>
                      F&O {getAssetPct(totalInvestedDerivatives)}%
                    </span>
                    <span style={{ color: '#A855F7', background: 'rgba(168, 85, 247, 0.1)', padding: '2px 7px', borderRadius: '4px', fontWeight: '600' }}>
                      MF {getAssetPct(totalInvestedMutualFunds)}%
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#38bdf8', fontWeight: '600' }}>
                  <span>{showAssetBreakdown ? 'Hide Charts' : 'View Charts'}</span>
                  {showAssetBreakdown ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </div>
              </div>
            </div>

            {/* Collapsible Content */}
            {showAssetBreakdown && (
              <div style={{
                padding: isMobile ? '12px' : '18px',
                borderTop: '1px solid var(--border-color)',
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1.2fr',
                gap: '16px'
              }}>
                {/* Left Box: Asset Allocation Donut Chart */}
                <div className="glass-panel" style={{
                  background: 'var(--bg-panel)',
                  padding: '16px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--card-shadow, 0 4px 16px rgba(0, 0, 0, 0.08))',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <PieChartIcon size={15} style={{ color: '#38bdf8' }} />
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>Asset Allocation</h4>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Total: <strong style={{ color: 'var(--text-primary)' }}>{formatShortCurrency(totalInvested)}</strong>
                    </span>
                  </div>

                  {/* Donut Chart Container */}
                  <div style={{ width: '100%', height: '190px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={82}
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
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Assets</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatShortCurrency(totalInvested)}</div>
                      <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '600' }}>100%</div>
                    </div>
                  </div>

                  {/* Bottom Quick Legend */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    {[
                      { name: 'Stocks', color: '#3B82F6', val: totalInvestedStocks },
                      { name: 'ETFs', color: '#10B981', val: totalInvestedETFs },
                      { name: 'Derivatives', color: '#F59E0B', val: totalInvestedDerivatives },
                      { name: 'Mutual Funds', color: '#A855F7', val: totalInvestedMutualFunds }
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: item.color }} />
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
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#3B82F6' }} />
                        <span style={{ fontWeight: '600', fontSize: '12.5px' }}>Stocks</span>
                      </div>
                      <span style={{ fontSize: '10.5px', background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                        {getAssetPct(totalInvestedStocks)}%
                      </span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {formatCurrency(totalInvestedStocks)}
                    </div>
                    {/* Progress bar */}
                    <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${getAssetPct(totalInvestedStocks)}%`, height: '100%', background: '#3B82F6', borderRadius: '2px' }} />
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                      {countStocks} Position(s) Active
                    </div>
                  </div>

                  {/* ETFs Card */}
                  <div className="glass-panel" style={{
                    background: 'var(--bg-panel)',
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#10B981' }} />
                        <span style={{ fontWeight: '600', fontSize: '12.5px' }}>ETFs</span>
                      </div>
                      <span style={{ fontSize: '10.5px', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                        {getAssetPct(totalInvestedETFs)}%
                      </span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {formatCurrency(totalInvestedETFs)}
                    </div>
                    {/* Progress bar */}
                    <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${getAssetPct(totalInvestedETFs)}%`, height: '100%', background: '#10B981', borderRadius: '2px' }} />
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                      {countETFs} ETF Scheme(s)
                    </div>
                  </div>

                  {/* Derivatives Card */}
                  <div className="glass-panel" style={{
                    background: 'var(--bg-panel)',
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#F59E0B' }} />
                        <span style={{ fontWeight: '600', fontSize: '12.5px' }}>Derivatives (F&O)</span>
                      </div>
                      <span style={{ fontSize: '10.5px', background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                        {getAssetPct(totalInvestedDerivatives)}%
                      </span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {formatCurrency(totalInvestedDerivatives)}
                    </div>
                    {/* Progress bar */}
                    <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${getAssetPct(totalInvestedDerivatives)}%`, height: '100%', background: '#F59E0B', borderRadius: '2px' }} />
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                      {countDerivatives} Contract(s) Held
                    </div>
                  </div>

                  {/* Mutual Funds Card */}
                  <div className="glass-panel" style={{
                    background: 'var(--bg-panel)',
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#A855F7' }} />
                        <span style={{ fontWeight: '600', fontSize: '12.5px' }}>Mutual Funds</span>
                      </div>
                      <span style={{ fontSize: '10.5px', background: 'rgba(168, 85, 247, 0.12)', color: '#9333ea', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                        {getAssetPct(totalInvestedMutualFunds)}%
                      </span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {formatCurrency(totalInvestedMutualFunds)}
                    </div>
                    {/* Progress bar */}
                    <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${getAssetPct(totalInvestedMutualFunds)}%`, height: '100%', background: '#A855F7', borderRadius: '2px' }} />
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                      {countMutualFunds} Mutual Fund(s)
                    </div>
                  </div>

                </div>

              </div>
            )}
          </div>

          {/* Holdings Section */}
          <div className="glass-panel" style={{
            background: 'var(--bg-panel)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--card-shadow, 0 4px 20px rgba(0, 0, 0, 0.08))',
            overflow: 'visible',
            contain: 'none'
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
                    { id: 'DERIVATIVES', label: 'Derivatives' },
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
            <div style={{ overflowX: isMobile ? 'auto' : 'visible', overflowY: 'visible', WebkitOverflowScrolling: 'touch' }}>
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
                              const rawQty = Number(pos.quantity);
                              const exitSide = (rawQty < 0 || pos.side === 'SELL') ? 'BUY' : 'SELL';
                              const exitQty = Math.abs(rawQty || 1);
                              useStore.getState().openOrderModal(pos.symbol, exitSide, pos.lotSize || pos.lotsize || 1, 'DEL', true, exitQty);
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                  {safeSymbol.split(':')[0] || 'NSE'} • CNC
                                </span>
                                {(Number(pos.quantity) < 0 || pos.side === 'SELL') && (
                                  <span style={{ fontSize: '10px', color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: '2px 5px', borderRadius: '4px', fontWeight: '700' }}>
                                    SELL
                                  </span>
                                )}
                              </div>
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
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12.5px' }}>
                  <thead style={{ position: 'sticky', top: isMobile ? '44px' : '48px', zIndex: 35 }}>
                    <tr style={{ background: '#0d1527', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <th style={{ position: 'sticky', top: isMobile ? '44px' : '48px', zIndex: 35, background: '#0d1527', padding: '9px 12px', fontWeight: '600', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Symbol / Scheme</th>
                      <th style={{ position: 'sticky', top: isMobile ? '44px' : '48px', zIndex: 35, background: '#0d1527', padding: '9px 10px', fontWeight: '600', textAlign: 'right', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Qty / Units</th>
                      <th style={{ position: 'sticky', top: isMobile ? '44px' : '48px', zIndex: 35, background: '#0d1527', padding: '9px 10px', fontWeight: '600', textAlign: 'right', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Avg Price</th>
                      <th style={{ position: 'sticky', top: isMobile ? '44px' : '48px', zIndex: 35, background: '#0d1527', padding: '9px 10px', fontWeight: '600', textAlign: 'right', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Live LTP / NAV</th>
                      <th style={{ position: 'sticky', top: isMobile ? '44px' : '48px', zIndex: 35, background: '#0d1527', padding: '9px 10px', fontWeight: '600', textAlign: 'right', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Day Change</th>
                      <th style={{ position: 'sticky', top: isMobile ? '44px' : '48px', zIndex: 35, background: '#0d1527', padding: '9px 10px', fontWeight: '600', textAlign: 'right', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Invested</th>
                      <th style={{ position: 'sticky', top: isMobile ? '44px' : '48px', zIndex: 35, background: '#0d1527', padding: '9px 10px', fontWeight: '600', textAlign: 'right', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Current</th>
                      <th style={{ position: 'sticky', top: isMobile ? '44px' : '48px', zIndex: 35, background: '#0d1527', padding: '9px 10px', fontWeight: '600', textAlign: 'right', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Total Return (P&L)</th>
                      <th style={{ position: 'sticky', top: isMobile ? '44px' : '48px', zIndex: 35, background: '#0d1527', padding: '9px 28px 9px 10px', fontWeight: '600', textAlign: 'center', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap', width: '170px', minWidth: '170px' }}>Actions</th>
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
                            <td style={{ padding: '9px 12px', fontWeight: '700' }}>
                              {pos.isMf ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span 
                                      title={pos.displayName}
                                      style={{ 
                                        color: 'var(--text-primary)', 
                                        fontSize: '13px', 
                                        maxWidth: isMobile ? '180px' : '260px', 
                                        overflow: 'hidden', 
                                        textOverflow: 'ellipsis', 
                                        whiteSpace: 'nowrap', 
                                        display: 'inline-block' 
                                      }}
                                    >
                                      {pos.displayName}
                                    </span>
                                    <span style={{ fontSize: '10px', color: '#a855f7', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', flexShrink: 0 }}>
                                      MUTUAL FUND
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                                    Code: {safeSymbol}
                                  </span>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{safeSymbol.split(':')[1] ? safeSymbol.split(':')[1].split('-')[0] : safeSymbol.split('-')[0]}</span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '2px 5px', borderRadius: '4px', fontWeight: '600' }}>
                                    {safeSymbol.split(':')[0] || 'NSE'}
                                  </span>
                                  <span style={{ 
                                    fontSize: '10px', 
                                    fontWeight: '700', 
                                    padding: '1px 5px', 
                                    borderRadius: '4px', 
                                    background: (Number(pos.quantity) < 0 || pos.side === 'SELL') ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)', 
                                    color: (Number(pos.quantity) < 0 || pos.side === 'SELL') ? '#ef4444' : '#38bdf8' 
                                  }}>
                                    {(Number(pos.quantity) < 0 || pos.side === 'SELL') ? 'SELL' : 'BUY'}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                              {pos.isMf ? Number(pos.qty).toFixed(4) : pos.qty}
                            </td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>₹{(parseFloat(pos.average_price) || 0).toFixed(2)}</td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: '600', color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>₹{(parseFloat(pos.ltp) || 0).toFixed(2)}</td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              {pos.isMf ? (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: '500' }}>
                                  Daily NAV
                                </div>
                              ) : (
                                <>
                                  <div style={{ color: (pos.chg || 0) >= 0 ? '#00E676' : '#FF3B30', fontWeight: '600' }}>
                                    {(pos.chg || 0) >= 0 ? '+' : ''}₹{(pos.chg || 0).toFixed(2)}
                                  </div>
                                  <div style={{ fontSize: '10.5px', color: (pos.chgp || 0) >= 0 ? '#00E676' : '#FF3B30', opacity: 0.85, fontWeight: '600' }}>
                                    {(pos.chgp || 0) >= 0 ? '+' : ''}{(pos.chgp || 0).toFixed(2)}%
                                  </div>
                                </>
                              )}
                            </td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(pos.invested)}</td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(pos.current)}</td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              <div style={{ color: pos.isProfit ? '#00E676' : '#FF3B30', fontWeight: '700' }}>
                                {pos.isProfit ? '+' : ''}{formatCurrency(pos.pnl)}
                              </div>
                              <div style={{ fontSize: '10.5px', color: pos.isProfit ? '#00E676' : '#FF3B30', opacity: 0.85, fontWeight: '600' }}>
                                {pos.isProfit ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                              </div>
                            </td>
                            <td style={{ padding: '9px 28px 9px 10px', textAlign: 'center', width: '170px', minWidth: '170px' }}>
                              <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>
                                {pos.isMf ? (
                                  <>
                                    <button
                                      onClick={() => handleMfAction(pos, 'INVEST')}
                                      title="Invest More in Fund"
                                      style={{
                                        background: 'rgba(168, 85, 247, 0.1)',
                                        color: '#a855f7',
                                        border: '1px solid rgba(168, 85, 247, 0.3)',
                                        padding: '3px 6px',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      INVEST
                                    </button>
                                    <button
                                      onClick={() => handleMfAction(pos, 'REDEEM')}
                                      title="Redeem Units"
                                      style={{
                                        background: 'rgba(255, 59, 48, 0.1)',
                                        color: '#FF3B30',
                                        border: '1px solid rgba(255, 59, 48, 0.3)',
                                        padding: '3px 6px',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
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
                                        padding: '3px 8px',
                                        borderRadius: '5px',
                                        fontSize: '10.5px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      + BUY
                                    </button>
                                    <button
                                      onClick={() => {
                                        const rawQty = Number(pos.quantity);
                                        const exitSide = (rawQty < 0 || pos.side === 'SELL') ? 'BUY' : 'SELL';
                                        const exitQty = Math.abs(rawQty || 1);
                                        useStore.getState().openOrderModal(pos.symbol, exitSide, pos.lotSize || pos.lotsize || 1, 'DEL', true, exitQty);
                                      }}
                                      title="Exit / Sell"
                                      style={{
                                        background: 'rgba(255, 59, 48, 0.1)',
                                        color: '#FF3B30',
                                        border: '1px solid rgba(255, 59, 48, 0.3)',
                                        padding: '3px 8px',
                                        borderRadius: '5px',
                                        fontSize: '10.5px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
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










