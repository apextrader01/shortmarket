import React, { useMemo, useState, useEffect } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Activity, X, Share2, RefreshCw, TrendingUp, Wallet } from 'lucide-react';
import PnLShareCardModal from './PnLShareCardModal';
import MutualFundDetailsModal from './MutualFundDetailsModal';
import { checkPositionConversionAllowed, isDerivativeContract } from '../utils/lotsizeHelper';
import { getTodayClosedPositions, getISTDate, isToday } from '../utils/pnlHelper';

const EMPTY_PRICES = {};

export default function PositionsView() {

  const isDeliveryPosition = (p) => {
    const prod = (p?.product_type || p?.productLabel || p?.product || '').toUpperCase();
    return prod === 'DEL' || prod === 'CNC' || prod === 'DELIVERY';
  };

  const isOvernightDelivery = (p) => {
    return isDeliveryPosition(p);
  };
  const [viewMode, setViewMode] = useState('OPEN'); // 'OPEN' | 'CLOSED' | 'HOLDINGS'
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [shareModalTrade, setShareModalTrade] = useState(null);
  const [convertModalPos, setConvertModalPos] = useState(null);
  const [convertLoading, setConvertLoading] = useState(false);
  const [selectedMfFund, setSelectedMfFund] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    useStore.getState().fetchUserData?.();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { positions, holdings, orders } = useStore(useShallow(state => ({ positions: state.positions, holdings: state.holdings, orders: state.orders })));
  
  const sourceData = useMemo(() => {
    if (viewMode === 'HOLDINGS') {
      const mergedHoldingsMap = {};
      // 1. Existing database holdings
      (holdings || []).forEach(h => {
        if (h && h.symbol) {
          mergedHoldingsMap[h.symbol] = {
            ...h,
            quantity: Number(h.quantity) || 0,
            average_price: Math.abs(Number(h.average_price) || 0),
            side: h.side || (Number(h.quantity) < 0 ? 'SELL' : 'BUY'),
            isDbHolding: true
          };
        }
      });

      // 2. Overnight delivery positions (bought yesterday or earlier)
      (positions || []).filter(p => Number(p.quantity) !== 0 && isOvernightDelivery(p)).forEach(p => {
        const qty = Number(p.quantity) || 0;
        const avg = Math.abs(Number(p.average_price) || 0);
        const cleanSym = (p.symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '');

        // Check if an existing DB holding exists for this symbol
        const matchedKey = Object.keys(mergedHoldingsMap).find(k => {
          const cleanK = k.replace(/^(NSE:|BSE:|MCX:)/i, '');
          return k === p.symbol || cleanK === cleanSym;
        });

        if (matchedKey && mergedHoldingsMap[matchedKey].isDbHolding) {
          const existing = mergedHoldingsMap[matchedKey];
          const prevQty = Number(existing.quantity) || 0;
          const prevPrice = Math.abs(Number(existing.average_price) || 0);
          const totalQty = prevQty + qty;
          const totalCost = (Math.abs(prevQty) * prevPrice) + (Math.abs(qty) * avg);
          const absTotalQty = Math.abs(totalQty);
          const weightedAvg = absTotalQty !== 0 ? (totalCost / absTotalQty) : prevPrice;
          existing.quantity = totalQty;
          existing.average_price = Math.abs(weightedAvg);
          existing.side = totalQty < 0 ? 'SELL' : 'BUY';
        } else {
          const key = `pos-del-${p.id || p.symbol}-${p.product_type || 'DEL'}`;
          mergedHoldingsMap[key] = {
            ...p,
            id: p.id || key,
            isOvernightPos: true,
            quantity: qty,
            average_price: Math.abs(avg),
            side: p.side || (qty < 0 ? 'SELL' : 'BUY')
          };
        }
      });

      return Object.values(mergedHoldingsMap).filter(h => Math.abs(Number(h.quantity)) > 0);
    } else if (viewMode === 'OPEN') {
      return (positions || []).filter(p => Number(p.quantity) !== 0 && !isOvernightDelivery(p));
    } else if (viewMode === 'CLOSED') {
      return getTodayClosedPositions(positions, orders);
    }
    return [];
  }, [viewMode, positions, holdings, orders]);

  const [partialExitPos, setPartialExitPos] = useState(null);
  const [partialExitQty, setPartialExitQty] = useState('');
  const [partialExitType, setPartialExitType] = useState('MARKET');
  const [partialExitPrice, setPartialExitPrice] = useState('');

  const isMutualFund = (sym, assetClass) => {
    if (assetClass === 'MUTUAL_FUND') return true;
    if (!sym || typeof sym !== 'string') return false;
    const clean = sym.includes(':') ? sym.split(':')[1] : sym;
    return clean.endsWith('-MF') || clean.includes('MUTUALFUND') || /^\d{5,6}$/.test(clean) || ['EDEL', 'MIRA', 'NIPP', 'EDEL-MF', 'MIRA-MF', 'NIPP-MF'].includes(clean);
  };

  const COMMODITIES_LIST = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'];

  const isDerivativeSymbol = (sym) => {
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
    if (isDerivativeSymbol(sym) || assetClass === 'DERIVATIVE' || assetClass === 'COMMODITY' || item?.segment === 'Option' || item?.segment === 'Future') return 2; // Derivatives (middle)
    return 1; // Stocks & ETFs (first)
  };

  const getMfName = (sym) => {
    if (!sym) return null;
    return mfNames[sym] || mfNames[sym + '-MF'] || mfNames[sym.replace('-MF', '')] || null;
  };

  const handleMfAction = (pos, mode = 'REDEEM') => {
    const rawSym = pos?.symbol || '';
    const cleanId = rawSym.replace('-MF', '').replace(/^(NSE:|BSE:|MCX:)/i, '');
    const fundName = getMfName(rawSym) || pos?.name || cleanId;
    setSelectedMfFund({
      id: cleanId,
      schemeCode: cleanId,
      name: fundName,
      nav: pos?.ltp || pos?.avg || pos?.average_price || 0,
      symbol: rawSym,
      initialMode: mode
    });
  };

  const [mfNames, setMfNames] = useState({});
  useEffect(() => {
    const symbols = (sourceData || []).map(p => p.symbol).filter(isMutualFund);
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
          const cleanId = String(symbol).replace('-MF', '');
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
  }, [sourceData, mfNames]);

  // ⚡ Performance optimization: closed positions have fixed realized PnL and do not re-render on ticks.
  // Open and holding positions subscribe exclusively to their own held symbols, ignoring unrelated ticks.
  const relevantSymbols = useMemo(() => {
    if (viewMode === 'CLOSED') return [];
    const syms = new Set();
    (sourceData || []).forEach(p => {
      if (p.symbol) syms.add(p.symbol);
    });
    return Array.from(syms);
  }, [sourceData, viewMode]);

  const relevantPrices = useStore(useShallow(state => {
    if (relevantSymbols.length === 0) return EMPTY_PRICES;
    const map = {};
    for (const sym of relevantSymbols) {
      if (state.prices[sym]) map[sym] = state.prices[sym];
    }
    return map;
  }));

  // Group positions by Symbol + Product Type (Flat List)
  const { flatPositions, globalMTM, totalInvested, totalCurrent } = useMemo(() => {
    let globalMTM = 0;
    let totalInvested = 0;
    let totalCurrent = 0;
    const symbolAgg = {};

    sourceData.forEach(pos => {
      const posQty = Number(pos.quantity) || 0;
      const isOpen = posQty !== 0;
      if (viewMode === 'OPEN' && !isOpen) return;
      if (viewMode === 'CLOSED' && isOpen) return;

      const normProd = viewMode === 'HOLDINGS' ? 'DEL' : (pos.product_type || 'INT');
      const key = `${pos.symbol}-${normProd}`;
      if (!symbolAgg[key]) {
         symbolAgg[key] = { ...pos, encumberedQty: 0, unencumberedQty: 0 };
      }
      
      const agg = symbolAgg[key];
      if (agg.id !== pos.id) { // Merge
         const prevQty = agg.quantity;
         agg.realized_pnl = (parseFloat(agg.realized_pnl) || 0) + (parseFloat(pos.realized_pnl) || 0);
         agg.closed_quantity = (parseFloat(agg.closed_quantity) || 0) + (parseFloat(pos.closed_quantity) || 0);
         if (isOpen) {
            const prevNum = Number(agg.quantity);
            const isAdding = (prevNum >= 0 && posQty >= 0) || (prevNum <= 0 && posQty <= 0);
            if (isAdding) {
              const currentTotal = Math.abs(prevNum) * Math.abs(parseFloat(agg.average_price || 0));
              const newTotal = Math.abs(posQty) * Math.abs(parseFloat(pos.average_price || 0));
              agg.quantity = prevNum + posQty;
              agg.average_price = Math.abs(agg.quantity) > 0 ? (currentTotal + newTotal) / Math.abs(agg.quantity) : agg.average_price;
            } else {
              // Offsetting / Reducing position (e.g. partial exit or reversal)
              const netQty = prevNum + posQty;
              if (Math.abs(prevNum) >= Math.abs(posQty)) {
                // Reduced position keeps original purchase price
                agg.quantity = netQty;
              } else {
                // Reversal: position flipped side, new average price applies to remaining net
                agg.quantity = netQty;
                agg.average_price = Math.abs(parseFloat(pos.average_price || 0));
              }
            }
          } else {
           if (Math.abs(parseFloat(pos.average_price)) > 0 && Math.abs(parseFloat(agg.average_price)) === 0) {
             agg.average_price = Math.abs(parseFloat(pos.average_price));
           }
           const prevClosed = Math.abs(parseFloat(agg.closed_quantity) || 0) - Math.abs(parseFloat(pos.closed_quantity) || 0);
           const prevExitTotal = Math.abs(prevClosed) * Math.abs(parseFloat(agg.exit_price || 0));
           const newExitTotal = Math.abs(parseFloat(pos.closed_quantity) || 0) * Math.abs(parseFloat(pos.exit_price || 0));
           const totalClosed = Math.abs(parseFloat(agg.closed_quantity)) || 1;
           agg.exit_price = (prevExitTotal + newExitTotal) / totalClosed;
         }
         
         if ((agg.product_type === 'BO' || agg.product_type === 'CO') && (pos.product_type !== 'BO' && pos.product_type !== 'CO')) {
             agg.product_type = pos.product_type;
         }
      }
      
      if (pos.product_type === 'BO' || pos.product_type === 'CO') {
         agg.encumberedQty += Math.abs(posQty);
      } else {
         agg.unencumberedQty += Math.abs(posQty);
      }
    });

    const flatList = [];
    Object.values(symbolAgg).forEach(pos => {
      const posQty = Number(pos.quantity) || 0;
      if (posQty === 0 && viewMode === 'OPEN') return;

      const priceData = relevantPrices[pos.symbol] || {};
      const avg = Math.abs(parseFloat(pos.average_price) || 0);
      const ltp = (typeof priceData.ltp === 'number' && priceData.ltp > 0) ? priceData.ltp : (avg || 0);
      const qty = posQty;
      
      const invested = avg * Math.abs(qty);
      const currentValue = ltp * Math.abs(qty);
      
      const isShort = Number(qty) < 0 || pos.side === 'SELL';
      const unrealizedPnl = (qty !== 0) 
          ? (isShort ? (invested - currentValue) : (currentValue - invested))
          : 0;
      const realizedPnl = parseFloat(pos.realized_pnl || 0);
      const pnl = unrealizedPnl + realizedPnl;
          
      const lotSize = priceData.lotsize || 1;
      
      const cleanSym = pos.symbol.includes(':') ? pos.symbol.split(':')[1] : pos.symbol;
      let segment = 'Stock';
      if (isMutualFund(pos.symbol)) {
        segment = 'MF';
      } else if (cleanSym.includes('ETF') || cleanSym.includes('BEES') || cleanSym.includes('LIQUID')) {
        segment = 'ETF';
      } else if (/(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(cleanSym)) {
        segment = 'Option';
      } else if (/(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(cleanSym) || cleanSym.endsWith('-FUT')) {
        segment = 'Future';
      }
      
      let exchange = 'NSE';
      if (isMutualFund(pos.symbol)) {
        exchange = 'MF';
      } else if (pos.symbol.startsWith('BSE:') || pos.symbol.includes('SENSEX') || pos.symbol.includes('BSE')) {
        exchange = 'BSE';
      } else if (pos.symbol.startsWith('MCX:') || pos.symbol.includes('NATURALGAS') || pos.symbol.includes('CRUDE') || pos.symbol.includes('MCX')) {
        exchange = 'MCX';
      }

      let productLabel = 'Delivery';
      if (pos.product_type === 'INT') productLabel = 'Intraday';
      if (pos.product_type === 'BO') productLabel = 'Bracket Order';
      if (pos.product_type === 'CO') productLabel = 'Cover Order';
      if (viewMode === 'HOLDINGS') productLabel = 'Delivery';
      
      const unencumberedQty = (pos.product_type === 'BO' || pos.product_type === 'CO') ? 0 : Math.abs(posQty);

      flatList.push({ 
        ...pos, unencumberedQty, ltp, avg, qty, pnl, unrealizedPnl, invested, lotSize, isOpen: qty !== 0,
        segment, exchange, productLabel, isMf: isMutualFund(pos.symbol, pos.asset_class)
      });

      if (viewMode === 'CLOSED') {
        const closedQty = Math.abs(parseFloat(pos.closed_quantity) || 1);
        const entryPrice = Math.abs(parseFloat(pos.average_price) || 0);
        const exitPrice = Math.abs(parseFloat(pos.exit_price || ltp) || 0);
        totalInvested += closedQty * entryPrice;
        totalCurrent += closedQty * exitPrice;
        globalMTM += realizedPnl;
      } else if (viewMode === 'HOLDINGS') {
        const hQty = Math.abs(pos.quantity !== undefined ? pos.quantity : qty);
        const isShortHolding = Number(pos.quantity !== undefined ? pos.quantity : qty) < 0 || pos.side === 'SELL';
        const inv = avg * hQty;
        const cur = (ltp || avg) * hQty;
        totalInvested += inv;
        totalCurrent += cur;
        const hPnl = isShortHolding ? (inv - cur) : (cur - inv);
        globalMTM += hPnl;
      } else {
        // OPEN
        totalInvested += invested;
        totalCurrent += currentValue;
        globalMTM += pnl;
      }
    });

    // Sort: 1. Stocks -> 2. Derivatives -> 3. Mutual Funds
    flatList.sort((a, b) => {
      const orderA = getAssetCategoryOrder(a);
      const orderB = getAssetCategoryOrder(b);
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return String(a.symbol || '').localeCompare(String(b.symbol || ''));
    });

    return { flatPositions: flatList, globalMTM, totalInvested, totalCurrent };
  }, [sourceData, relevantPrices, viewMode]);

  const exitAllPositions = async () => {
    const openPositions = flatPositions.filter(p => Number(p.qty) !== 0 && Number(p.unencumberedQty) > 0 && p.product_type !== 'BO' && p.product_type !== 'CO');
    if (openPositions.length === 0) {
      alert('No valid unencumbered positions to exit.');
      return;
    }
    if (!window.confirm(`Exit ALL ${openPositions.length} unencumbered position(s) at market price?`)) return;
    const store = useStore.getState();
    let failed = 0;
    let lastError = '';
    const results = await Promise.allSettled(openPositions.map(async (pos) => {
      // Cancel any resting pending orders or trigger orders for this symbol first
      const cleanSym = (pos.symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
      const restingOrders = (store.orders || []).filter(o => {
        if (o.status !== 'PENDING' && o.status !== 'PENDING_TRIGGER') return false;
        const oClean = (o.symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
        return o.symbol === pos.symbol || oClean === cleanSym;
      });
      for (const ord of restingOrders) {
        await store.cancelOrder(ord.id).catch(() => {});
      }

      const exitSide = Number(pos.qty) > 0 ? 'SELL' : 'BUY';
      const liveLtp = prices[pos.symbol]?.ltp || 0;
      const effectiveProductType = (pos.product_type === 'BO' || pos.product_type === 'CO') ? 'INT' : (pos.product_type || 'DEL');
      const payload = {
        symbol: pos.symbol,
        type: 'MARKET',
        side: exitSide,
        quantity: Math.abs(Number(pos.unencumberedQty)),
        price: liveLtp,
        sl_price: null,
        tgt_price: null,
        margin: 0,
        lotsize: pos.lotSize || 1,
        product_type: effectiveProductType
      };
      const res = await store.placeOrder(payload);
      if (res && res.success) {
        store.clearPendingTriggersForSymbol(pos.symbol);
        return { success: true };
      } else {
        const err = store.authError || (res && res.error) || 'Failed to place exit order';
        return { success: false, error: err };
      }
    }));

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.success) {
        // success
      } else {
        failed++;
        lastError = r.status === 'fulfilled' ? r.value.error : (r.reason?.message || 'Exit request failed');
      }
    }
    await store.fetchUserData();
    if (failed > 0) {
      alert(`${failed} order(s) failed: ${lastError}`);
    }
  };

  return (
    <div style={{ padding: isMobile ? '12px 12px 40px 12px' : '20px', width: '100%', boxSizing: 'border-box', background: 'var(--bg-main)', overflowY: 'auto', position: 'relative' }}>
      {/* Top Header Bar with Tabs, Live MTM Widget, and Exit Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '12px' : '20px', flexWrap: 'wrap', gap: '12px' }}>
        {/* Left: Title & Sub-tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Positions</h2>
          <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setViewMode('OPEN')}
              style={{ background: viewMode === 'OPEN' ? '#2563eb' : 'transparent', color: viewMode === 'OPEN' ? '#ffffff' : 'var(--text-secondary)', border: 'none', padding: isMobile ? '5px 10px' : '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: isMobile ? '11px' : '12px', fontWeight: '700', transition: 'all 0.15s' }}
            >
              OPEN
            </button>
            <button
              onClick={() => setViewMode('HOLDINGS')}
              style={{ background: viewMode === 'HOLDINGS' ? '#2563eb' : 'transparent', color: viewMode === 'HOLDINGS' ? '#ffffff' : 'var(--text-secondary)', border: 'none', padding: isMobile ? '5px 10px' : '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: isMobile ? '11px' : '12px', fontWeight: '700', transition: 'all 0.15s' }}
            >
              HOLDINGS
            </button>
            <button
              onClick={() => setViewMode('CLOSED')}
              style={{ background: viewMode === 'CLOSED' ? '#2563eb' : 'transparent', color: viewMode === 'CLOSED' ? '#ffffff' : 'var(--text-secondary)', border: 'none', padding: isMobile ? '5px 10px' : '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: isMobile ? '11px' : '12px', fontWeight: '700', transition: 'all 0.15s' }}
            >
              CLOSED
            </button>
          </div>
        </div>

        {/* Center/Right: Summary Metrics Group (Invested, Current & Total P&L) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '8px' : '10px',
          flexWrap: 'wrap'
        }}>
          {/* Total Invested */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            padding: isMobile ? '5px 10px' : '6px 12px',
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={14} color="#3b82f6" />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.1 }}>
                {viewMode === 'CLOSED' ? 'Total Entry' : 'Total Invested'}
              </div>
              <div style={{ fontSize: isMobile ? '13px' : '15px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px', lineHeight: 1.1 }}>
                ₹{totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Current Value */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            padding: isMobile ? '5px 10px' : '6px 12px',
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={14} color="#a855f7" />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.1 }}>
                {viewMode === 'CLOSED' ? 'Total Exit' : 'Current Value'}
              </div>
              <div style={{ fontSize: isMobile ? '13px' : '15px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px', lineHeight: 1.1 }}>
                ₹{totalCurrent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* TOTAL PORTFOLIO MTM Widget */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: globalMTM >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${globalMTM >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            padding: isMobile ? '5px 10px' : '6px 14px',
            borderRadius: '10px',
            boxShadow: `0 4px 16px ${globalMTM >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color={globalMTM >= 0 ? '#10B981' : '#EF4444'} />
              <div>
                <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', lineHeight: 1.1 }}>
                  {viewMode === 'CLOSED' ? 'TOTAL REALIZED P&L' : 'TOTAL PORTFOLIO MTM'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.1 }}>
                  {viewMode === 'CLOSED' ? "Today's settled trades" : 'Live market ticks'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginLeft: '4px' }}>
              <span style={{
                fontSize: isMobile ? '13px' : '15px',
                fontWeight: '900',
                letterSpacing: '-0.3px',
                color: globalMTM >= 0 ? '#10B981' : '#EF4444'
              }}>
                {globalMTM >= 0 ? '+' : ''}₹{globalMTM.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {totalInvested > 0 && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: globalMTM >= 0 ? '#10B981' : '#EF4444',
                  opacity: 0.9
                }}>
                  ({globalMTM >= 0 ? '+' : ''}{((globalMTM / totalInvested) * 100).toFixed(2)}%)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Exit Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {viewMode === 'OPEN' && flatPositions.length > 0 && (
            <button
              onClick={exitAllPositions}
              style={{
                background: 'var(--color-red-light)', color: '#fff', border: 'none',
                padding: isMobile ? '7px 14px' : '8px 18px', borderRadius: '6px', fontSize: isMobile ? '11px' : '12px', fontWeight: '800', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                width: isMobile ? '100%' : 'auto',
                transition: 'all 0.15s'
              }}
            >
              EXIT ALL POSITIONS ⚡
            </button>
          )}
          {viewMode === 'HOLDINGS' && flatPositions.length > 0 && (
            <button
              onClick={async () => {
                if (!window.confirm(`Are you sure you want to EXIT ALL ${flatPositions.length} active holdings at current market price?`)) return;
                try {
                  const token = useStore.getState().token || localStorage.getItem('token');
                  const res = await fetch(`${API}/api/holdings/exit-all`, {
                    credentials: 'include',
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                  });
                  const data = await res.json();
                  if (res.ok) {
                    alert(data.message || 'Successfully exited all holdings!');
                    useStore.getState().fetchUserData();
                  } else {
                    alert(data.error || 'Failed to exit holdings');
                  }
                } catch (e) {
                  alert('Error exiting holdings: ' + e.message);
                }
              }}
              style={{
                background: 'var(--color-red-light)', color: '#fff', border: 'none',
                padding: isMobile ? '7px 14px' : '8px 18px', borderRadius: '6px', fontSize: isMobile ? '11px' : '12px', fontWeight: '800', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                width: isMobile ? '100%' : 'auto',
                transition: 'all 0.15s'
              }}
            >
              EXIT ALL HOLDINGS ⚡
            </button>
          )}
        </div>
      </div>
      
      {flatPositions.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ 
            width: '120px', height: '100px', background: 'var(--bg-panel)', 
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)', marginBottom: '24px'
          }}>
            <Activity size={40} color="var(--color-green-light)" />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
            {viewMode === 'CLOSED' ? 'No closed positions yet' : viewMode === 'HOLDINGS' ? 'You have no active holdings' : 'You do not have any positions'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
            {viewMode === 'CLOSED' ? 'Positions you close today will appear here.' : viewMode === 'HOLDINGS' ? 'Long-term delivery positions will appear here on T+1.' : 'List of all your positions for today will appear here.'}
          </p>
        </div>
      ) : (
        <>
          {!isMobile && (
            <div className="desktop-view">
              <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="responsive-mobile-table positions-layout positions-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>
                    {viewMode === 'HOLDINGS' ? 'Holding / Scheme' : 'Instrument'}
                  </th>
                  {viewMode === 'OPEN' && (
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontWeight: '600' }}>Side</th>
                  )}
                  <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '600' }}>
                    {viewMode === 'CLOSED' ? 'Closed Qty' : viewMode === 'HOLDINGS' ? 'Qty / Units' : 'Net Qty'}
                  </th>
                  <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '600' }}>
                    {viewMode === 'HOLDINGS' ? 'Avg. Buy Price' : viewMode === 'CLOSED' ? 'Entry Price' : 'Avg. Price'}
                  </th>
                  <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '600' }}>
                    {viewMode === 'CLOSED' ? 'Exit Price' : viewMode === 'HOLDINGS' ? 'Live LTP / NAV' : 'Last Price (LTP)'}
                  </th>
                  {viewMode === 'HOLDINGS' && (
                    <>
                      <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '600' }}>Invested Value</th>
                      <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '600' }}>Current Value</th>
                    </>
                  )}
                  {viewMode !== 'CLOSED' && (
                    <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '600' }}>
                      {viewMode === 'HOLDINGS' ? 'Total P&L' : 'Unrealized P&L (MTM)'}
                    </th>
                  )}
                  {viewMode !== 'HOLDINGS' && (
                    <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '600' }}>Realized P&L</th>
                  )}
                  {viewMode === 'CLOSED' && (
                    <th style={{ padding: '12px 12px', textAlign: 'center', fontWeight: '600' }}>Status</th>
                  )}
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {flatPositions.map((pos, idx) => {
                  const rawQty = Number(pos.quantity !== undefined ? pos.quantity : pos.qty);
                  const isShort = rawQty < 0 || pos.side === 'SELL';
                  const isBuy = !isShort;
                  const sideText = isShort ? 'SELL' : 'BUY';
                  const isProfit = pos.pnl >= 0;
                  const realizedPnl = parseFloat(pos.realized_pnl) || 0;
                  const isMf = isMutualFund(pos.symbol);
                  const mfName = isMf ? getMfName(pos.symbol) : null;
                  const safeSymbol = pos.symbol || '';
                  const cleanSym = safeSymbol.split(':')[1] ? safeSymbol.split(':')[1].split('-')[0] : safeSymbol.split('-')[0];
                  const exchange = (safeSymbol.includes(':') ? safeSymbol.split(':')[0] : pos.exchange) || 'NSE';
                  const holdingQty = Math.abs(rawQty);
                  const investedVal = Math.abs(pos.avg || 0) * holdingQty;
                  const currentVal = ((pos.ltp || pos.avg) || 0) * holdingQty;
                  const holdingPnl = isShort ? (investedVal - currentVal) : (currentVal - investedVal);
                  const holdingPnlPct = investedVal > 0 ? (holdingPnl / investedVal) * 100 : 0;

                  return (
                    <tr 
                      key={pos.id || idx} 
                      style={{ 
                        borderBottom: '1px solid var(--border-color)', 
                        background: idx % 2 === 0 ? 'var(--bg-card)' : 'transparent',
                        transition: 'background 0.15s ease' 
                      }}
                    >
                      {/* Column 1: Symbol / Scheme */}
                      <td data-label="Symbol" style={{ padding: '12px 16px' }}>
                        {isMf ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--text-primary)' }}>
                                {mfName || cleanSym}
                              </span>
                              <span style={{ fontSize: '10px', color: '#a855f7', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                                MF
                              </span>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              Code: {safeSymbol}
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--text-primary)' }}>
                              {cleanSym}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-hover)', padding: '2px 5px', borderRadius: '4px', fontWeight: '600' }}>
                              {exchange}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--color-blue-light)', background: 'rgba(59,130,246,0.1)', padding: '2px 5px', borderRadius: '4px', fontWeight: '600' }}>
                              {viewMode === 'HOLDINGS' ? 'CNC' : (pos.productLabel || pos.product_type || 'INT')}
                            </span>
                            {viewMode === 'HOLDINGS' && (
                              <span style={{ 
                                fontSize: '10px', 
                                fontWeight: '700', 
                                padding: '1px 5px', 
                                borderRadius: '4px', 
                                background: isBuy ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)', 
                                color: isBuy ? '#38bdf8' : '#ef4444' 
                              }}>
                                {sideText}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Column 2: Side (Only in OPEN) */}
                      {viewMode === 'OPEN' && (
                        <td data-label="Side" style={{ padding: '12px 12px' }}>
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: '700',
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            background: isBuy ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)',
                            color: isBuy ? '#38bdf8' : '#ef4444'
                          }}>
                            {sideText}
                          </span>
                        </td>
                      )}

                      {/* Column 3: Quantity */}
                      <td data-label="Qty" style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {viewMode === 'CLOSED' 
                          ? (isMf 
                              ? Number(pos.closed_quantity || 0).toFixed(4) 
                              : Math.round(Math.abs(pos.closed_quantity || 0)).toLocaleString('en-IN')) 
                          : viewMode === 'HOLDINGS' && isMf 
                            ? Number(holdingQty).toFixed(4) 
                            : (isMf 
                              ? Number(pos.qty || holdingQty || 0).toFixed(4) 
                              : Math.round(Math.abs(pos.qty || holdingQty || 0)).toLocaleString('en-IN'))}
                      </td>

                      {/* Column 4: Avg Price */}
                      <td data-label="Avg Price" style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '500', color: 'var(--text-secondary)' }}>
                        ₹{Math.abs(parseFloat(pos.avg) || 0).toFixed(2)}
                      </td>

                      {/* Column 5: Last Price (LTP) / Exit Price */}
                      <td data-label="LTP" style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '600', color: '#2563eb' }}>
                        {viewMode === 'CLOSED' 
                          ? (pos.exit_price ? `₹${Math.abs(parseFloat(pos.exit_price)).toFixed(2)}` : '—') 
                          : (pos.ltp > 0 ? `₹${parseFloat(pos.ltp).toFixed(2)}` : '—')}
                      </td>

                      {/* Column 6 & 7: Invested & Current Value (HOLDINGS only) */}
                      {viewMode === 'HOLDINGS' && (
                        <>
                          <td data-label="Invested" style={{ padding: '12px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '500' }}>
                            ₹{investedVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td data-label="Current" style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)' }}>
                            ₹{currentVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </>
                      )}

                      {/* Column: Unrealized P&L / Total P&L */}
                      {viewMode === 'OPEN' && (
                        <td data-label="Unrealized P&L" style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '700', color: (pos.unrealizedPnl || 0) >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                          {(pos.unrealizedPnl || 0) > 0 ? '+' : ((pos.unrealizedPnl || 0) < 0 ? '-' : '')}₹{Math.abs(pos.unrealizedPnl || 0).toFixed(2)}
                        </td>
                      )}
                      {viewMode === 'HOLDINGS' && (
                        <td data-label="Total P&L" style={{ padding: '12px 12px', textAlign: 'right' }}>
                          <div style={{ fontWeight: '700', color: holdingPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                            {holdingPnl >= 0 ? '+' : ''}₹{holdingPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: holdingPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', opacity: 0.85 }}>
                            {holdingPnl >= 0 ? '+' : ''}{holdingPnlPct.toFixed(2)}%
                          </div>
                        </td>
                      )}

                      {/* Column: Realized P&L (OPEN & CLOSED) */}
                      {viewMode !== 'HOLDINGS' && (
                        <td data-label="Realized P&L" style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '700', color: realizedPnl > 0 ? 'var(--color-green-light)' : (realizedPnl < 0 ? 'var(--color-red-light)' : 'var(--text-muted)') }}>
                          {realizedPnl !== 0 ? `${realizedPnl > 0 ? '+' : '-'}₹${Math.abs(realizedPnl).toFixed(2)}` : '₹0.00'}
                        </td>
                      )}

                      {/* Column: Status (CLOSED only) */}
                      {viewMode === 'CLOSED' && (
                        <td data-label="Status" style={{ padding: '12px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: '4px' }}>
                            CLOSED
                          </span>
                        </td>
                      )}

                      {/* Column: Actions */}
                      <td data-label="Actions" style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            title="Share P&L Social Card"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShareModalTrade({
                                symbol: pos.symbol,
                                realized_pnl: viewMode === 'HOLDINGS' ? holdingPnl : (realizedPnl !== 0 ? realizedPnl : (pos.pnl || 0)),
                                pnl: viewMode === 'HOLDINGS' ? holdingPnl : (realizedPnl !== 0 ? realizedPnl : (pos.pnl || 0)),
                                avg: pos.avg,
                                exit_price: pos.exit_price || pos.ltp,
                                qty: Math.abs(pos.qty || pos.closed_quantity || holdingQty || 1),
                                product_type: pos.productLabel || pos.product_type || (viewMode === 'HOLDINGS' ? 'DEL' : 'INT'),
                                side: pos.qty >= 0 ? 'BUY' : 'SELL'
                              });
                            }}
                            style={{
                              background: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              color: '#38bdf8',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}
                          >
                            <Share2 size={12} /> Share
                          </button>

                          {viewMode === 'OPEN' && (() => {
                            const currentProd = String(pos.product_type || pos.productLabel || 'INT').toUpperCase();
                            const isCurrentlyInt = (currentProd === 'INT' || currentProd === 'MIS');
                            const targetProd = isCurrentlyInt ? 'DEL' : 'INT';
                            const isShortCashEquity = Number(pos.quantity) < 0 && targetProd === 'DEL' && !isDerivativeContract(pos.symbol);

                            const convCheck = isShortCashEquity 
                              ? { allowed: false, reason: 'Short cash equity positions cannot be converted to Delivery (CNC). Only intraday shorting is permitted.' }
                              : checkPositionConversionAllowed(pos.symbol, targetProd);
                            const isConvBlocked = !convCheck.allowed;
                            return (
                              <button
                                type="button"
                                title={isConvBlocked ? convCheck.reason : `Convert to ${targetProd === 'DEL' ? 'Delivery (CNC)' : 'Intraday (MIS)'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isConvBlocked) {
                                    alert(convCheck.reason);
                                    return;
                                  }
                                  setConvertModalPos(pos);
                                }}
                                style={{
                                  background: isConvBlocked ? 'rgba(148, 163, 184, 0.08)' : 'rgba(99, 102, 241, 0.1)',
                                  border: `1px solid ${isConvBlocked ? 'rgba(148, 163, 184, 0.2)' : 'rgba(99, 102, 241, 0.25)'}`,
                                  color: isConvBlocked ? 'var(--text-secondary)' : '#818cf8',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  cursor: isConvBlocked ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  opacity: isConvBlocked ? 0.6 : 1
                                }}
                              >
                                <RefreshCw size={11} /> Convert
                              </button>
                            );
                          })()}

                          {viewMode === 'OPEN' && (
                            <X 
                              size={18} 
                              style={{ cursor: 'pointer', color: 'var(--text-secondary)', transition: 'color 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-red-light)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                              title="Exit Position"
                              onClick={() => {
                                if (pos.unencumberedQty === 0) {
                                  alert('This position is fully tied to BO/CO pending triggers. To exit, please cancel or modify the pending orders in the Orders tab.');
                                  return;
                                }
                                setPartialExitPos(pos);
                                const ls = pos.lotSize || 1;
                                setPartialExitQty((Math.abs(pos.unencumberedQty) / ls).toString());
                                setPartialExitType('MARKET');
                                setPartialExitPrice(pos.ltp > 0 ? pos.ltp.toFixed(2) : '');
                              }}
                            />
                          )}

                          {viewMode === 'HOLDINGS' && (
                            isMf ? (
                              <button
                                type="button"
                                title="Redeem Mutual Fund"
                                onClick={() => handleMfAction(pos, 'REDEEM')}
                                style={{
                                  background: 'rgba(168, 85, 247, 0.1)',
                                  border: '1px solid rgba(168, 85, 247, 0.3)',
                                  color: '#a855f7',
                                  borderRadius: '4px',
                                  padding: '2px 8px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: '700'
                                }}
                              >
                                REDEEM
                              </button>
                            ) : (
                              <X 
                                size={18} 
                                style={{ cursor: 'pointer', color: 'var(--text-secondary)', transition: 'color 0.2s' }}
                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-red-light)'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                                title="Exit Holding"
                                onClick={() => {
                                  const exitSide = isShort ? 'BUY' : 'SELL';
                                  const exitQty = Math.abs(rawQty || 1);
                                  useStore.getState().openOrderModal(pos.symbol, exitSide, pos.lotSize || pos.lotsize || 1, 'DEL', true, exitQty);
                                }}
                              />
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
          </div>
            )}
          <div className="mobile-view">
            {isMobile && (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                {/* 📊 Compact Kite-Style Positions Summary Bar */}
                <div className="glass-panel" style={{ 
                  background: 'var(--bg-panel)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  padding: '10px 14px', 
                  marginBottom: '10px',
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  boxShadow: 'var(--card-shadow, 0 2px 8px rgba(0,0,0,0.05))'
                }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>
                      {viewMode === 'CLOSED' ? 'Realized P&L' : 'Total MTM'}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: globalMTM >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                      {globalMTM >= 0 ? '+' : ''}₹{globalMTM.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>
                      {viewMode === 'CLOSED' ? 'Entry' : 'Invested'}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: '700' }}>
                      ₹{totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>
                      {viewMode === 'CLOSED' ? 'Exit' : 'Current'}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: '700' }}>
                      ₹{totalCurrent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* 📱 High-Density Kite/Fyers Position Rows (6-8 fit on screen) */}
                {flatPositions.map((pos, idx) => {
                  const rawQty = Number(pos.quantity !== undefined ? pos.quantity : pos.qty);
                  const isShort = rawQty < 0 || pos.side === 'SELL';
                  const isBuy = !isShort;
                  const sideText = isShort ? 'SELL' : 'BUY';
                  const isProfit = pos.pnl >= 0;
                  const realizedPnl = parseFloat(pos.realized_pnl) || 0;
                  const isMf = isMutualFund(pos.symbol, pos.asset_class) || Boolean(pos.isMf);
                  const mfName = isMf ? getMfName(pos.symbol) : null;
                  const holdingQty = Math.abs(rawQty);
                  const posAvg = Math.abs(pos.avg || parseFloat(pos.average_price) || 0);
                  const displayPnl = viewMode === 'CLOSED' 
                    ? realizedPnl 
                    : (viewMode === 'HOLDINGS' 
                      ? (isShort ? ((posAvg - (pos.ltp || posAvg)) * Math.abs(rawQty)) : (((pos.ltp || posAvg) - posAvg) * Math.abs(rawQty))) 
                      : (pos.pnl !== undefined ? pos.pnl : (isShort ? ((posAvg - (pos.ltp || posAvg)) * Math.abs(rawQty)) : (((pos.ltp || posAvg) - posAvg) * Math.abs(rawQty)))));
                  const isDisplayProfit = displayPnl >= 0;
                  const investedBase = pos.invested > 0 
                    ? pos.invested 
                    : (Math.abs(parseFloat(pos.closed_quantity) || 1) * Math.max(1, posAvg));
                  const pnlPercent = investedBase > 0 ? (displayPnl / investedBase) * 100 : 0;

                  return (
                    <div 
                      key={idx}
                      onClick={() => {
                        if (viewMode === 'CLOSED') return;
                        if (viewMode === 'OPEN') {
                          if (pos.unencumberedQty === 0) {
                            alert('This position is fully tied to BO/CO pending triggers. To exit, please cancel or modify the pending orders in the Orders tab.');
                            return;
                          }
                          setPartialExitPos(pos);
                          const ls = pos.lotSize || 1;
                          setPartialExitQty((Math.abs(pos.unencumberedQty) / ls).toString());
                          setPartialExitType('MARKET');
                          setPartialExitPrice(pos.ltp > 0 ? pos.ltp.toFixed(2) : '');
                        } else if (viewMode === 'HOLDINGS') {
                          if (isMf) {
                            handleMfAction(pos, 'REDEEM');
                          } else {
                            const exitSide = isShort ? 'BUY' : 'SELL';
                            const exitQty = Math.abs(rawQty || 1);
                            useStore.getState().openOrderModal(pos.symbol, exitSide, pos.lotSize || pos.lotsize || 1, 'DEL', true, exitQty);
                          }
                        }
                      }}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border-color)',
                        background: 'transparent',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        cursor: viewMode === 'CLOSED' ? 'default' : 'pointer'
                      }}
                    >
                      {/* Line 1: Product/Segment & Side (Left) | PnL Value (Right) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: '3px', fontWeight: '600' }}>
                            {pos.productLabel || (viewMode === 'HOLDINGS' ? 'CNC' : 'NRML')}
                          </span>
                          <span style={{ fontSize: '10.5px', fontWeight: '700', color: isBuy ? 'var(--color-green-light)' : 'var(--color-red-light)', background: isBuy ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                            {viewMode === 'CLOSED' ? 'CLOSED' : sideText}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: isDisplayProfit ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                          {viewMode === 'CLOSED' ? 'Realized: ' : 'MTM: '}{displayPnl > 0 ? '+' : (displayPnl < 0 ? '-' : '')}₹{Math.abs(displayPnl).toFixed(2)}
                        </div>
                      </div>

                      {/* Line 2: Symbol Name (Left) | PnL % (Right) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ maxWidth: '68%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {isMf && mfName ? mfName : (pos.symbol.split(':')[1] ? pos.symbol.split(':')[1].split('-')[0] : pos.symbol.split('-')[0])}
                            </span>
                            {isMf && (
                              <span style={{ fontSize: '9px', color: '#a855f7', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', padding: '1px 4px', borderRadius: '3px', fontWeight: '700' }}>
                                MF
                              </span>
                            )}
                          </div>
                          {isMf ? (
                            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={mfName || pos.symbol}>
                              Code: {pos.symbol}
                            </div>
                          ) : (
                            pos.name && (
                              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {pos.name}
                              </div>
                            )
                          )}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: isDisplayProfit ? 'var(--color-green-light)' : 'var(--color-red-light)', marginTop: '2px' }}>
                          ({isDisplayProfit ? '+' : ''}{pnlPercent.toFixed(2)}%)
                        </div>
                      </div>

                      {/* Line 3: Qty & Avg Price (Left) | LTP & Actions (Right) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                        <div>
                          {isMf ? 'Units' : 'Qty'}: {viewMode === 'CLOSED' 
                            ? (isMf ? Number(pos.closed_quantity || 0).toFixed(4) : Math.round(Math.abs(pos.closed_quantity || 0)).toLocaleString('en-IN')) 
                            : (viewMode === 'HOLDINGS' && isMf 
                                ? Number(holdingQty).toFixed(4) 
                                : (isMf ? Number(pos.qty || holdingQty || 0).toFixed(4) : Math.round(Math.abs(pos.qty || holdingQty || 0)).toLocaleString('en-IN')))} • Avg: ₹{Math.abs(pos.avg || 0).toFixed(2)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{isMf ? 'NAV' : 'LTP'}: ₹{viewMode === 'CLOSED' ? (pos.exit_price ? Math.abs(parseFloat(pos.exit_price)).toFixed(2) : '—') : (pos.ltp > 0 ? pos.ltp.toFixed(2) : '—')}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const relPnl = parseFloat(pos.realized_pnl) || 0;
                              setShareModalTrade({
                                symbol: pos.symbol,
                                realized_pnl: relPnl !== 0 ? relPnl : (pos.pnl || 0),
                                pnl: relPnl !== 0 ? relPnl : (pos.pnl || 0),
                                avg: pos.avg,
                                exit_price: pos.exit_price || pos.ltp,
                                qty: Math.abs(pos.qty || pos.closed_quantity || 1),
                                product_type: pos.productLabel || pos.product_type || 'INT',
                                side: pos.qty >= 0 ? 'BUY' : 'SELL'
                              });
                            }}
                            style={{
                              fontSize: '10px',
                              color: '#38bdf8',
                              background: 'rgba(56,189,248,0.12)',
                              border: '1px solid rgba(56,189,248,0.3)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <Share2 size={10} /> Share
                          </button>
                          {viewMode === 'OPEN' && (() => {
                            const currentProd = String(pos.product_type || pos.productLabel || 'INT').toUpperCase();
                            const isCurrentlyInt = (currentProd === 'INT' || currentProd === 'MIS');
                            const targetProd = isCurrentlyInt ? 'DEL' : 'INT';
                            const isShortCashEquity = Number(pos.quantity) < 0 && targetProd === 'DEL' && !isDerivativeContract(pos.symbol);

                            const convCheck = isShortCashEquity 
                              ? { allowed: false, reason: 'Short cash equity positions cannot be converted to Delivery (CNC). Only intraday shorting is permitted.' }
                              : checkPositionConversionAllowed(pos.symbol, targetProd);
                            const isConvBlocked = !convCheck.allowed;
                            return (
                              <button
                                type="button"
                                title={isConvBlocked ? convCheck.reason : `Convert to ${targetProd === 'DEL' ? 'Delivery (CNC)' : 'Intraday (MIS)'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isConvBlocked) {
                                    alert(convCheck.reason);
                                    return;
                                  }
                                  setConvertModalPos(pos);
                                }}
                                style={{
                                  fontSize: '10px',
                                  color: isConvBlocked ? 'var(--text-secondary)' : '#818cf8',
                                  background: isConvBlocked ? 'rgba(148, 163, 184, 0.08)' : 'rgba(99,102,241,0.12)',
                                  border: `1px solid ${isConvBlocked ? 'rgba(148, 163, 184, 0.2)' : 'rgba(99,102,241,0.3)'}`,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: '700',
                                  cursor: isConvBlocked ? 'not-allowed' : 'pointer',
                                  opacity: isConvBlocked ? 0.6 : 1
                                }}
                              >
                                Convert
                              </button>
                            );
                          })()}
                          {(viewMode === 'OPEN' || viewMode === 'HOLDINGS') && (
                            <span 
                              onClick={(e) => {
                                if (isMf && viewMode === 'HOLDINGS') {
                                  e.stopPropagation();
                                  handleMfAction(pos, 'REDEEM');
                                }
                              }}
                              style={{ 
                                fontSize: '10px', 
                                color: isMf ? '#a855f7' : 'var(--color-red-light)', 
                                border: `1px solid ${isMf ? 'rgba(168,85,247,0.3)' : 'rgba(239,68,68,0.3)'}`, 
                                background: isMf ? 'rgba(168,85,247,0.08)' : 'transparent',
                                padding: '1px 5px', 
                                borderRadius: '3px', 
                                fontWeight: '600' 
                              }}
                            >
                              {isMf ? 'Redeem ✕' : 'Exit ✕'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}



      {/* Partial Exit Modal */}
      {partialExitPos && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-dark)', width: '380px', borderRadius: '12px',
            border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Partial Exit</h3>
              <X size={18} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setPartialExitPos(null)} />
            </div>
            <div style={{ padding: '24px 20px' }}>
              <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: '600', color: 'var(--color-blue-light)' }}>
                {partialExitPos.symbol}
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {partialExitPos.lotSize > 1 ? 'Lots' : 'Qty'} (Max: {Math.abs(partialExitPos.unencumberedQty !== undefined ? partialExitPos.unencumberedQty : partialExitPos.qty) / (partialExitPos.lotSize || 1)})
                  </label>
                  <input
                    type="number"
                    value={partialExitQty}
                    onChange={(e) => setPartialExitQty(e.target.value)}
                    max={Math.abs(partialExitPos.unencumberedQty !== undefined ? partialExitPos.unencumberedQty : partialExitPos.qty) / (partialExitPos.lotSize || 1)}
                    min="1"
                    step={partialExitPos && ((partialExitPos.symbol || '').endsWith('-MF') || (partialExitPos.symbol || '').includes(':MF')) ? "any" : "1"}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Order Type</label>
                  <select
                    value={partialExitType}
                    onChange={(e) => setPartialExitType(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '4px', outline: 'none' }}
                  >
                    <option value="MARKET" style={{color:'#000'}}>Market</option>
                    <option value="LIMIT" style={{color:'#000'}}>Limit</option>
                  </select>
                </div>
              </div>

              {partialExitType === 'LIMIT' && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Limit Price</label>
                  <input
                    type="number"
                    value={partialExitPrice}
                    onChange={(e) => setPartialExitPrice(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>
              )}

              <button
                onClick={async () => {
                  const inputVal = parseFloat(partialExitQty);
                  const ls = partialExitPos.lotSize || 1;
                  const isMfPos = (partialExitPos.symbol || '').endsWith('-MF') || (partialExitPos.symbol || '').includes(':MF');
                  const qtyToExit = isMfPos ? parseFloat((inputVal * ls).toFixed(4)) : Math.round(inputVal * ls);
                  const maxQty = Math.abs(partialExitPos.unencumberedQty);
                  if (!qtyToExit || qtyToExit <= 0 || qtyToExit > maxQty) {
                    alert(`Invalid quantity. Max allowed (unencumbered): ${maxQty / ls} lots`);
                    return;
                  }
                  if (partialExitType === 'LIMIT' && (!partialExitPrice || parseFloat(partialExitPrice) <= 0 || isNaN(parseFloat(partialExitPrice)))) {
                    alert('Please enter a valid limit price greater than 0.');
                    return;
                  }
                  const isExitShort = Number(partialExitPos.qty) < 0 || partialExitPos.side === 'SELL';
                  const exitSide = isExitShort ? 'BUY' : 'SELL';
                  const ok = await useStore.getState().placeOrder({
                    symbol: partialExitPos.symbol,
                    type: partialExitType,
                    side: exitSide,
                    quantity: qtyToExit,
                    lotsize: ls,
                    price: partialExitType === 'MARKET' ? (prices[partialExitPos.symbol]?.ltp || 0) : parseFloat(partialExitPrice),
                    sl_price: null,
                    tgt_price: null,
                    margin: 0,
                    product_type: (partialExitPos.product_type === 'BO' || partialExitPos.product_type === 'CO') ? 'INT' : (partialExitPos.product_type || 'DEL')
                  });
                  if (ok && ok.success) {
                    setPartialExitPos(null);
                  } else {
                    const storeErr = useStore.getState().authError;
                    alert(`Exit failed: ${(ok && ok.error) || storeErr || 'Check the browser console (F12) for error details.'}`);
                  }
                }}
                style={{
                  width: '100%', background: isExitShort ? 'var(--color-blue)' : 'var(--color-red)',
                  color: 'var(--text-primary)', border: 'none', padding: '12px', borderRadius: '6px', fontSize: '14px',
                  fontWeight: 'bold', cursor: 'pointer', marginTop: partialExitType === 'MARKET' ? '12px' : '0'
                }}
              >
                {isExitShort ? 'BUY' : 'SELL'} {partialExitQty} {partialExitPos.lotSize > 1 ? 'LOTS' : 'QTY'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert Position Modal */}
      {convertModalPos && (() => {
        const currentProd = String(convertModalPos.product_type || convertModalPos.productLabel || 'INT').toUpperCase();
        const isCurrentlyInt = (currentProd === 'INT' || currentProd === 'MIS');
        const targetProd = isCurrentlyInt ? 'DEL' : 'INT';
        const absQty = Math.abs(Number(convertModalPos.qty || convertModalPos.quantity || 1));
        const avgPrice = Number(convertModalPos.avg || convertModalPos.average_price || 0);
        const existingMargin = Number(convertModalPos.margin || 0);
        const totalGrossValue = absQty * avgPrice;
        const netAddlCashRequired = isCurrentlyInt ? Math.max(0, totalGrossValue - existingMargin) : 0;

        const isShortCashEquity = Number(convertModalPos.quantity || convertModalPos.qty || 0) < 0 && targetProd === 'DEL' && !isDerivativeContract(convertModalPos.symbol);
        const convCheck = isShortCashEquity 
          ? { allowed: false, reason: 'Short cash equity positions cannot be converted to Delivery (CNC). Only intraday shorting is permitted.' }
          : checkPositionConversionAllowed(convertModalPos.symbol, targetProd);
        const isConvBlocked = !convCheck.allowed;
        const blockReason = convCheck.reason;

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}>
            <div style={{
              background: 'var(--bg-dark)', width: '380px', borderRadius: '12px',
              border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Convert Position</h3>
                <X size={18} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setConvertModalPos(null)} />
              </div>
              <div style={{ padding: '24px 20px' }}>
                <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: '600', color: 'var(--color-blue-light)' }}>
                  {convertModalPos.symbol}
                </div>
                <div style={{ background: 'var(--bg-hover)', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Current Product:</span>
                    <span style={{ fontWeight: '700' }}>{currentProd} ({isCurrentlyInt ? 'Intraday / MIS' : 'Delivery / CNC'})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Target Product:</span>
                    <span style={{ fontWeight: '700', color: '#818cf8' }}>{targetProd} ({targetProd === 'DEL' ? 'Delivery / CNC' : 'Intraday / MIS'})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Quantity:</span>
                    <span style={{ fontWeight: '700' }}>{absQty}</span>
                  </div>
                  {isCurrentlyInt && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Total Delivery Value:</span>
                        <span style={{ fontWeight: '600' }}>₹{totalGrossValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Intraday Margin Blocked:</span>
                        <span style={{ fontWeight: '600', color: 'var(--color-blue-light)' }}>₹{existingMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Additional Cash Required:</span>
                        <span style={{ fontWeight: '700', color: 'var(--color-green-light)' }}>₹{netAddlCashRequired.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}
                </div>

                {isConvBlocked && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    fontSize: '11.5px',
                    lineHeight: '1.4'
                  }}>
                    ⚠️ <strong>Conversion Blocked:</strong> {blockReason}
                  </div>
                )}

                <button
                  disabled={convertLoading || isConvBlocked}
                  onClick={async () => {
                    if (isConvBlocked) {
                      alert(blockReason);
                      return;
                    }
                    setConvertLoading(true);
                    try {
                      const posId = convertModalPos.id;
                      const res = await useStore.getState().convertPosition(posId, targetProd, netAddlCashRequired);
                      if (res && res.success) {
                        alert(`Position successfully converted to ${targetProd}!`);
                        setConvertModalPos(null);
                      } else {
                        alert(`Conversion failed: ${res?.error || 'Insufficient funds or conversion rejected.'}`);
                      }
                    } catch (err) {
                      alert(`Error: ${err.message}`);
                    } finally {
                      setConvertLoading(false);
                    }
                  }}
                  style={{
                    width: '100%',
                    background: isConvBlocked ? '#4b5563' : '#6366f1',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: (convertLoading || isConvBlocked) ? 'not-allowed' : 'pointer',
                    opacity: (convertLoading || isConvBlocked) ? 0.6 : 1
                  }}
                >
                  {convertLoading ? 'Converting...' : isConvBlocked ? 'Conversion Blocked' : `Convert to ${targetProd}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {shareModalTrade && (
        <PnLShareCardModal
          trade={shareModalTrade}
          onClose={() => setShareModalTrade(null)}
        />
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











