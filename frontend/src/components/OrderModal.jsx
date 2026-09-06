import { useShallow } from 'zustand/react/shallow';
import React, { useState, useEffect } from 'react';
import { useStore, API } from '../store';
import { X, Maximize2, Info, RefreshCw, FileText, Plus, Zap, ShoppingBag } from 'lucide-react';
import { getInstantLotsize } from '../utils/lotsizeHelper';
import { getFreezeLimit, calculateOrderSlices } from '../utils/freezeLimits';

export default function OrderModal() {
  const { orderModal, closeOrderModal, user, restrictedStocks, openMarketDepthModal, marketDepthModal, marketStatus, marketCalendar } = useStore(useShallow(state => ({ 
    orderModal: state.orderModal, 
    closeOrderModal: state.closeOrderModal, 
    user: state.user, 
    restrictedStocks: state.restrictedStocks, 
    openMarketDepthModal: state.openMarketDepthModal, 
    marketDepthModal: state.marketDepthModal, 
    marketStatus: state.marketStatus,
    marketCalendar: state.marketCalendar 
  })));
  const livePriceData = useStore(state => state.prices[orderModal?.symbol]);
  const [orderType, setOrderType] = useState('LIMIT'); // LIMIT, MARKET
  const [productType, setProductType] = useState('INT'); // INT, DEL
  const [tab, setTab] = useState('Regular'); // Regular, Stop Loss, GTT, SIP
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [slTrigger, setSlTrigger] = useState('');
  const [trailingJump, setTrailingJump] = useState('');
  const [isCO, setIsCO] = useState(false);
  const [isBO, setIsBO] = useState(false);
  const [slPrice, setSlPrice] = useState('');
  const [tgtPrice, setTgtPrice] = useState('');
  const [showCautionPopup, setShowCautionPopup] = useState(false);
  const [showIntradayBlockedPopup, setShowIntradayBlockedPopup] = useState(false);
  
  // Tax estimates
  const [estimatedTaxes, setEstimatedTaxes] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [showBreakup, setShowBreakup] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);

  // Local side state (B/S)
  const [side, setSide] = useState('BUY');

  const symbol = orderModal.symbol;
  const livePrice = symbol ? livePriceData?.ltp || 0 : 0;
  const isUp = symbol ? livePriceData?.pct >= 0 : true;

  // Initialize modal state when it opens
  useEffect(() => {
    if (orderModal.isOpen) {
      setSide(orderModal.type);
      setProductType(orderModal.productType || 'INT');
      
      const effectiveLotsize = (orderModal.lotsize && Number(orderModal.lotsize) > 1) 
        ? Number(orderModal.lotsize) 
        : getInstantLotsize(orderModal.symbol);
      
      if (effectiveLotsize > 1 && orderModal.lotsize !== effectiveLotsize) {
        useStore.getState().setOrderModalLotsize(effectiveLotsize);
      }

      if (orderModal.totalExitQty) {
          setQuantity(Math.max(1, Math.round(orderModal.totalExitQty / effectiveLotsize)));
      } else {
          setQuantity(1);
      }
      
      // Fetch initial price imperatively to avoid re-running on every live tick
      const currentLivePrice = useStore.getState().prices[orderModal.symbol]?.ltp || 0;
      setPrice(currentLivePrice ? currentLivePrice.toFixed(2) : '');
      
      // Background sync lotsize if still 1 and looks like a derivative (contains numbers)
      if (effectiveLotsize === 1 && /\d/.test(orderModal.symbol)) {
        fetch(`${API}/api/stocks/lotsizes?symbols=${orderModal.symbol}`)
          .then(r => r.json())
          .then(data => {
            if (data[orderModal.symbol] && data[orderModal.symbol] > 1) {
              const ls = data[orderModal.symbol];
              useStore.getState().setOrderModalLotsize(ls);
              if (orderModal.totalExitQty) {
                  setQuantity(Math.max(1, Math.round(orderModal.totalExitQty / ls)));
              }
            }
          }).catch(console.error);
      }
    }
  }, [orderModal.isOpen, orderModal.symbol, orderModal.type]);

  const balanceNum = Number(user?.balance) || 0;
  const totalQuantity = quantity * (orderModal.lotsize || 1);
  const isBuy = side === 'BUY';
  const cleanSym = symbol ? (symbol.includes(':') ? symbol.split(':')[1] : symbol) : '';
  const isOption = /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(cleanSym);
  const isMutualFund = cleanSym.endsWith('-MF') || /^\d{5,6}$/.test(cleanSym) || ['EDEL', 'MIRA', 'NIPP', 'EDEL-MF', 'MIRA-MF', 'NIPP-MF'].includes(cleanSym);
  
  // Fetch Estimated Charges
  useEffect(() => {
    if (!symbol || !totalQuantity) return;
    const fetchEst = async () => {
       setIsEstimating(true);
       try {
         const p = orderType === 'MARKET' ? livePrice : parseFloat(price);
         if (!p) {
             setEstimatedTaxes(0);
             return;
         }
         const token = useStore.getState().token;
         const res = await fetch(`${API}/api/estimate-charges?symbol=${symbol}&product_type=${productType}&side=${side}&quantity=${totalQuantity}&price=${p}`, {
            headers: { 'Authorization': `Bearer ${token}` }
         });
         const data = await res.json();
         if (data.totalTaxes !== undefined) {
             setEstimatedTaxes(data);
         }
       } catch (err) {
         console.error('Failed to estimate taxes', err);
       } finally {
         setIsEstimating(false);
       }
    };
    
    const timer = setTimeout(fetchEst, 400); // Debounce
    return () => clearTimeout(timer);
  }, [symbol, productType, side, totalQuantity, price, orderType, livePrice]);

  const isFuture = /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(cleanSym) || cleanSym.endsWith('-FUT');
  const leverageMultiplier = (productType === 'INT' && !isOption && !isFuture) ? 0.25 : 1.0; // 4x Leverage ONLY for Intraday Stocks
  
  let baseMargin = totalQuantity * (orderType === 'MARKET' ? livePrice : (parseFloat(price) || 0));
  
  if (isOption && !isBuy) {
    // Extract strike price robustly. Broker symbols often look like NIFTY30JUN2623900PE
    // This regex looks for a 3-letter month and 2-digit year before the strike digits.
    const cleanSymbol = symbol.split('-')[0];
    let optionStrike = 0;
    const robustMatch = cleanSymbol.match(/(?:\d{2}[A-Z]{3}|\d{2}[1-9A-Z]\d{2})(\d+)(?:CE|PE)$/i);
    if (robustMatch) {
      optionStrike = parseFloat(robustMatch[1]);
    } else {
      const strikeMatch = cleanSymbol.match(/(\d+)(CE|PE)$/i);
      if (strikeMatch) {
         let rawStrikeStr = strikeMatch[1];
         if (rawStrikeStr.length > 5) rawStrikeStr = rawStrikeStr.substring(rawStrikeStr.length - 5);
         optionStrike = parseFloat(rawStrikeStr);
      }
    }
    // Index vs Stock differentiation
    const isIndex = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCPNIFTY'].some(idx => symbol.includes(idx));
    
    // 10% (10x leverage) for Index Options, 20% (5x leverage) for highly volatile Stock Options
    const marginRate = isIndex ? 0.10 : 0.20; 
    
    if (optionStrike > 0) {
      const grossMargin = optionStrike * totalQuantity * marginRate;
      // Subtract the premium you collect from the buyer (baseMargin holds the premium value initially)
      baseMargin = Math.max(grossMargin - baseMargin, 0); 
    } else {
      // Fallback
      baseMargin = totalQuantity * (isIndex ? 4000 : 8000);
    }
  } else if (isFuture) {
    // Futures Margin Calculation (Symmetric for Buy and Sell)
    const isIndex = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCPNIFTY'].some(idx => symbol.includes(idx));
    const marginRate = isIndex ? 0.10 : 0.15; // 10% for Index Futures, 15% for Stock/Commodity Futures
    baseMargin = baseMargin * marginRate;
  }

  // FIX: isTrueExit must compare against orderModal.type (not orderModal.side which doesn't exist)
  // When true, the sell is an exit of an existing holding — no margin required
  const isTrueExit = orderModal.isExit && side === orderModal.type;
  const requiredMargin = isTrueExit ? 0 : baseMargin * leverageMultiplier;
  const isInsufficient = !isTrueExit && balanceNum < requiredMargin;

  let leverageText = '';
  if (isOption) {
      leverageText = isBuy ? '1x' : 'SPAN';
  } else {
      const totalValue = totalQuantity * (orderType === 'MARKET' ? livePrice : (parseFloat(price) || 0));
      const effectiveLeverage = requiredMargin > 0 ? (totalValue / requiredMargin) : 1;
      leverageText = `${Math.round(effectiveLeverage)}x`;
  }

  const isRestricted = restrictedStocks.includes(symbol);
  
  const cleanSymbolName = (symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
  const isCommodity = (symbol || '').includes('MCX') || ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'].some(c => cleanSymbolName.startsWith(c));
  
  const getMarketSession = () => {
    const status = isCommodity ? (marketStatus?.commodity || 'AUTO') : (marketStatus?.equity || 'AUTO');
    if (status === 'OPEN') return { open: true, mode: 'OPEN' };
    if (status === 'CLOSED') {
      return { 
        open: false, 
        mode: 'CLOSED', 
        reason: `${isCommodity ? 'MCX Commodity' : 'NSE/BSE Equity'} market is currently marked as CLOSED / Holiday by Administrator.` 
      };
    }

    // 1. Check Date-Specific Calendar Override
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const y = istTime.getFullYear();
    const m = String(istTime.getMonth() + 1).padStart(2, '0');
    const d = String(istTime.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    
    const calRule = (marketCalendar || []).find(r => r.date === todayStr);
    if (calRule) {
      const segStatus = isCommodity ? calRule.commodity_status : calRule.equity_status;
      const holidayReason = calRule.reason || (isCommodity ? 'MCX Commodity Market Holiday' : 'NSE/BSE Equity Market Holiday');
      
      if (segStatus === 'CLOSED') {
        return {
          open: false,
          mode: 'CLOSED',
          reason: `${isCommodity ? 'MCX Commodity' : 'NSE/BSE Equity'} market is CLOSED today (${holidayReason}).`
        };
      }
      
      if (segStatus === 'OPEN') {
        const startTimeStr = isCommodity ? (calRule.commodity_start_time || '09:00') : (calRule.equity_start_time || '09:15');
        const endTimeStr = isCommodity ? (calRule.commodity_end_time || '23:30') : (calRule.equity_end_time || '15:30');
        const [sH, sM] = startTimeStr.split(':').map(Number);
        const [eH, eM] = endTimeStr.split(':').map(Number);
        const curMins = istTime.getHours() * 60 + istTime.getMinutes();
        const startMins = sH * 60 + (sM || 0);
        const endMins = eH * 60 + (eM || 0);
        
        if (curMins < startMins || curMins >= endMins) {
          return {
            open: false,
            mode: 'AUTO',
            reason: `Today's special session for ${isCommodity ? 'MCX' : 'NSE/BSE'} (${holidayReason}) is open only between ${startTimeStr} and ${endTimeStr} IST.`
          };
        }
        return { open: true, mode: 'OPEN' };
      }
    }

    // 2. AUTO mode: Check weekend & normal hours
    const day = istTime.getDay(); // 0 = Sun, 6 = Sat
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();

    if (day === 0 || day === 6) {
      return { open: false, mode: 'AUTO', reason: 'Markets are closed on weekends (Saturday & Sunday).' };
    }

    if (productType === 'INT' || isBO || isCO) {
      if (isCommodity) {
        const isBeforeOpen = hours < 9;
        const isAfterClose = hours > 22 || (hours === 22 && minutes >= 50);
        if (isBeforeOpen || isAfterClose) {
          return { open: false, mode: 'AUTO', reason: 'Intraday/BO/CO trading for Commodities is allowed only between 9:00 AM and 10:50 PM IST.' };
        }
      } else {
        const isBeforeOpen = hours < 9 || (hours === 9 && minutes < 15);
        const isAfterClose = hours > 15 || (hours === 15 && minutes >= 15);
        if (isBeforeOpen || isAfterClose) {
          return { open: false, mode: 'AUTO', reason: 'Intraday/BO/CO trading for Equities is allowed only between 9:15 AM and 3:15 PM IST.' };
        }
      }
    }
    return { open: true, mode: 'AUTO' };
  };

  const marketSession = getMarketSession();
  const isTimeBlocked = marketSession.mode === 'AUTO' && !marketSession.open;
  const isIntradayBlocked = (isRestricted || isTimeBlocked) && productType === 'INT';

  const handlePlaceOrder = async () => {
    if (marketSession.mode === 'CLOSED') {
      alert(marketSession.reason);
      return;
    }
    if (isIntradayBlocked) {
       setShowIntradayBlockedPopup(true);
       return;
    }
    if (isRestricted && !showCautionPopup) {
       setShowCautionPopup(true);
       return;
    }

    // Validate Bracket Order (BO) and Cover Order (CO) formats
    if (isBO || isCO) {
      const entryPrice = orderType === 'MARKET' ? livePrice : parseFloat(price);
      if (!entryPrice || entryPrice <= 0) {
        alert("Please enter a valid price to place a Bracket/Cover order.");
        return;
      }
      
      const parsedSL = slPrice ? parseFloat(slPrice) : 0;
      const parsedTgt = tgtPrice ? parseFloat(tgtPrice) : 0;
      
      if (isCO && !parsedSL) {
        alert("Please specify a Stop Loss price for your Cover Order (CO).");
        return;
      }
      if (isBO && (!parsedSL || !parsedTgt)) {
        alert("Please specify both Stop Loss and Target prices for your Bracket Order (BO).");
        return;
      }
      
      if (side === 'BUY') {
        if (parsedSL && parsedSL >= entryPrice) {
          alert(`Invalid Stop Loss: For a BUY order, Stop Loss price (${parsedSL}) must be lower than the entry price (${entryPrice.toFixed(2)}).`);
          return;
        }
        if (parsedTgt && parsedTgt <= entryPrice) {
          alert(`Invalid Target: For a BUY order, Target price (${parsedTgt}) must be higher than the entry price (${entryPrice.toFixed(2)}).`);
          return;
        }
      } else { // SELL
        if (parsedSL && parsedSL <= entryPrice) {
          alert(`Invalid Stop Loss: For a SELL order, Stop Loss price (${parsedSL}) must be higher than the entry price (${entryPrice.toFixed(2)}).`);
          return;
        }
        if (parsedTgt && parsedTgt >= entryPrice) {
          alert(`Invalid Target: For a SELL order, Target price (${parsedTgt}) must be lower than the entry price (${entryPrice.toFixed(2)}).`);
          return;
        }
      }
    }

    let finalType = orderType;
    if (tab === 'Stop Loss') finalType = orderType === 'MARKET' ? 'SL-M' : 'SL-L';
    if (tab === 'Trailing SL') finalType = 'TRAILING_STOP';
    if (tab === 'GTT') finalType = 'GTT';

    const payload = {
      symbol,
      type: finalType,
      side,
      quantity: totalQuantity,
      price: orderType === 'MARKET' ? livePrice : parseFloat(price),
      trigger_price: (tab === 'Stop Loss' || tab === 'Trailing SL' || tab === 'GTT') && slTrigger ? parseFloat(slTrigger) : null,
      trail_amount: tab === 'Trailing SL' && trailingJump ? parseFloat(trailingJump) : null,
      sl_price: (isCO || isBO) && slPrice ? parseFloat(slPrice) : null,
      tgt_price: isBO && tgtPrice ? parseFloat(tgtPrice) : null,
      margin: requiredMargin, // Backend will deduct this
      product_type: isBO ? 'BO' : isCO ? 'CO' : productType,
      lotsize: orderModal.lotsize || 1
    };

    try {
      setIsPlacing(true);
      const result = await useStore.getState().placeOrder(payload);
      setIsPlacing(false);
      if (result && result.success) {
        closeOrderModal();
        if (result.status === 'EXECUTED') {
          alert("✅ Order Executed Successfully!");
        } else if (result.status === 'PENDING_TRIGGER') {
          alert("⏳ Trigger Order Placed (Pending Trigger)");
        } else if (result.status === 'REJECTED') {
          alert("❌ Order Rejected!");
        } else {
          alert("⏳ Order Placed (Pending)");
        }
      } else {
        const errorMsg = useStore.getState().authError || "Failed to place order. Please try again.";
        alert(errorMsg);
      }
    } catch (err) {
      setIsPlacing(false);
      alert("Error: " + (err.message || 'Failed to place order.'));
    }
  };

  if (!orderModal.isOpen || !symbol) return null;

  return (
    <div 
      className="modal-backdrop" 
      onClick={(e) => {
        if (e.target === e.currentTarget) closeOrderModal();
      }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
    >
      <div style={{
        width: '540px', 
        maxWidth: '95vw',
        background: '#161b26', 
        borderRadius: '10px', 
        border: '1px solid rgba(255, 255, 255, 0.1)', 
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column',
        transform: marketDepthModal?.isOpen ? 'translateX(-260px)' : 'none',
        transition: 'transform 0.3s ease-in-out',
        animation: 'fadeInScale 0.15s ease-out'
      }}>
        
        {/* Fyers-Style Vibrant Header */}
        <div style={{ 
          background: isBuy ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'linear-gradient(135deg, #dc2626, #b91c1c)', 
          padding: '14px 18px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          color: '#ffffff'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: '#ffffff', letterSpacing: '0.3px' }}>
                {isBuy ? 'Buy' : 'Sell'} {symbol.split('-')[0]}
              </h2>
              <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                {symbol?.startsWith('MCX:') ? 'MCX' : symbol?.startsWith('BSE:') ? 'BSE' : 'NSE'}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '3px', fontWeight: '500' }}>
              {symbol?.startsWith('MCX:') ? 'MCX' : symbol?.startsWith('BSE:') ? 'BSE' : 'NSE'}: ₹{livePrice.toFixed(2)}
              <span style={{ marginLeft: '6px', fontSize: '12px', opacity: 0.85 }}>
                {isUp ? '▲' : '▼'} {livePriceData?.pct !== undefined ? `${livePriceData.pct >= 0 ? '+' : ''}${livePriceData.pct.toFixed(2)}%` : ''}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Smooth B / S Toggle */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '20px', padding: '2px', border: '1px solid rgba(255,255,255,0.2)' }}>
              <button 
                type="button"
                onClick={() => setSide('BUY')}
                style={{ 
                  background: isBuy ? '#ffffff' : 'transparent', 
                  color: isBuy ? '#1d4ed8' : 'rgba(255,255,255,0.8)',
                  border: 'none', 
                  borderRadius: '16px', 
                  width: '28px', 
                  height: '22px', 
                  fontSize: '11px', 
                  fontWeight: '800', 
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}>B</button>
              <button 
                type="button"
                onClick={() => setSide('SELL')}
                style={{ 
                  background: !isBuy ? '#ffffff' : 'transparent', 
                  color: !isBuy ? '#b91c1c' : 'rgba(255,255,255,0.8)',
                  border: 'none', 
                  borderRadius: '16px', 
                  width: '28px', 
                  height: '22px', 
                  fontSize: '11px', 
                  fontWeight: '800', 
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}>S</button>
            </div>
            <button 
              type="button"
              onClick={() => openMarketDepthModal(symbol, orderModal.lotsize || 1)}
              title="Market Depth"
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ffffff' }}
            >
              <Maximize2 size={13} />
            </button>
            <button 
              type="button"
              onClick={closeOrderModal} 
              title="Close"
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ffffff' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Product Type Tabs (Intraday / Overnight / GTT) */}
        {!isTrueExit && (
        <div style={{ padding: '14px 20px 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', background: '#0e121a', borderRadius: '6px', padding: '3px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button
              type="button"
              onClick={() => setProductType('INT')} 
              style={{ 
                padding: '6px 14px', 
                borderRadius: '4px',
                border: 'none',
                display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                background: productType === 'INT' ? '#2563eb' : 'transparent',
                color: productType === 'INT' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '12.5px', fontWeight: '600',
                transition: 'all 0.15s ease'
              }}
            >
              Intraday
            </button>
            <button
              type="button"
              onClick={() => {
                setProductType('DEL');
                setIsCO(false);
                setIsBO(false);
              }} 
              style={{ 
                padding: '6px 14px', 
                borderRadius: '4px',
                border: 'none',
                display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                background: productType === 'DEL' ? '#2563eb' : 'transparent',
                color: productType === 'DEL' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '12.5px', fontWeight: '600',
                transition: 'all 0.15s ease'
              }}
            >
              {isOption || isFuture ? 'Overnight' : 'Delivery'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setTab(tab === 'GTT' ? 'Regular' : 'GTT')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: tab === 'GTT' ? 'rgba(59, 130, 246, 0.2)' : '#0e121a',
              color: tab === 'GTT' ? '#60a5fa' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            GTT
          </button>
        </div>
        )}

        {/* Form Body */}
        <div style={{ padding: '14px 20px 18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.2px' }}>
              {productType === 'INT' ? 'Intraday' : (isOption || isFuture ? 'Overnight' : 'CNC')} • {orderType === 'MARKET' ? 'Market Order' : 'Limit Order'}
            </div>
          </div>

          {/* 3-Column Inputs Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '12px' }}>
            {/* Qty */}
            <div>
              <fieldset style={{ margin: 0, padding: 0, border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', background: '#0e121a' }}>
                <legend style={{ marginLeft: '10px', padding: '0 4px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>Qty(Lot: {orderModal.lotsize || 1})</legend>
                <input 
                  type="number" 
                  step={1}
                  min={1}
                  value={quantity} 
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '') { setQuantity(''); return; }
                    const num = parseInt(val, 10);
                    if (!isNaN(num)) setQuantity(Math.max(1, num));
                  }}
                  onBlur={e => {
                    const num = parseInt(e.target.value, 10);
                    setQuantity(Math.max(1, isNaN(num) ? 1 : num));
                  }}
                  style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 10px', color: '#ffffff', fontSize: '14px', fontWeight: '600', outline: 'none' }} 
                />
              </fieldset>
              {orderModal.lotsize > 1 && (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', paddingLeft: '2px' }}>
                  Total Qty: {(parseInt(quantity) || 0) * orderModal.lotsize}
                </div>
              )}
            </div>

            {/* Price */}
            <div>
              <fieldset style={{ margin: 0, padding: 0, border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', background: '#0e121a', opacity: orderType === 'MARKET' ? 0.6 : 1 }}>
                <legend style={{ marginLeft: '10px', padding: '0 4px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>Price(Tick: 0.05)</legend>
                <input 
                  type="text" 
                  value={orderType === 'MARKET' ? (livePrice ? livePrice.toFixed(2) : '0.00') : price} 
                  onChange={e => setPrice(e.target.value)} 
                  disabled={orderType === 'MARKET'}
                  style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 10px', color: '#ffffff', fontSize: '14px', fontWeight: '600', outline: 'none' }} 
                />
              </fieldset>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', cursor: 'pointer', paddingLeft: '2px' }}>
                <input type="checkbox" checked={orderType === 'MARKET'} onChange={e => setOrderType(e.target.checked ? 'MARKET' : 'LIMIT')} style={{ accentColor: '#2563eb' }} /> 
                Market price
              </label>
            </div>

            {/* Trigger Price */}
            <div>
              <fieldset style={{ margin: 0, padding: 0, border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', background: '#0e121a', opacity: tab !== 'Stop Loss' ? 0.5 : 1 }}>
                <legend style={{ marginLeft: '10px', padding: '0 4px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>Trigger Price</legend>
                <input 
                  type="text" 
                  placeholder={tab !== 'Stop Loss' ? '—' : '0.00'}
                  value={slTrigger} 
                  onChange={e => setSlTrigger(e.target.value)}
                  disabled={tab !== 'Stop Loss'}
                  style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 10px', color: '#ffffff', fontSize: '14px', fontWeight: '600', outline: 'none' }} 
                />
              </fieldset>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', cursor: 'pointer', paddingLeft: '2px' }}>
                <input type="checkbox" checked={tab === 'Stop Loss'} onChange={e => setTab(e.target.checked ? 'Stop Loss' : 'Regular')} style={{ accentColor: '#2563eb' }} /> 
                Trigger {side.toLowerCase()}
              </label>
            </div>
          </div>

          {/* Intraday Stoploss & Take Profit (CO & BO) */}
          {productType === 'INT' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '12px' }}>
              <div></div>
              <div>
                <fieldset style={{ margin: 0, padding: 0, border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', background: '#0e121a', opacity: !(isCO || isBO) ? 0.5 : 1 }}>
                  <legend style={{ marginLeft: '10px', padding: '0 4px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>Stoploss</legend>
                  <input 
                    type="text" 
                    placeholder={!(isCO || isBO) ? '—' : '0.00'}
                    value={slPrice}
                    onChange={e => setSlPrice(e.target.value)}
                    disabled={!(isCO || isBO)}
                    style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 10px', color: '#ffffff', fontSize: '14px', fontWeight: '600', outline: 'none' }} 
                  />
                </fieldset>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', cursor: 'pointer', paddingLeft: '2px' }}>
                  <input type="checkbox" checked={isCO} onChange={e => { setIsCO(e.target.checked); if (e.target.checked) setIsBO(false); }} style={{ accentColor: '#2563eb' }} /> 
                  CO (Cover Order)
                </label>
              </div>

              <div>
                <fieldset style={{ margin: 0, padding: 0, border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', background: '#0e121a', opacity: !isBO ? 0.5 : 1 }}>
                  <legend style={{ marginLeft: '10px', padding: '0 4px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>Take Profit</legend>
                  <input 
                    type="text" 
                    placeholder={!isBO ? '—' : '0.00'}
                    value={tgtPrice}
                    onChange={e => setTgtPrice(e.target.value)}
                    disabled={!isBO}
                    style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 10px', color: '#ffffff', fontSize: '14px', fontWeight: '600', outline: 'none' }} 
                  />
                </fieldset>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', cursor: 'pointer', paddingLeft: '2px' }}>
                  <input type="checkbox" checked={isBO} onChange={e => { setIsBO(e.target.checked); if (e.target.checked) setIsCO(false); }} style={{ accentColor: '#2563eb' }} /> 
                  BO (Bracket Order)
                </label>
              </div>
            </div>
          )}

          {/* Slicing Notice Banner */}
          {totalQuantity > getFreezeLimit(symbol, orderModal.lotsize) && (
            <div style={{ 
              fontSize: '11.5px', 
              color: '#93c5fd', 
              background: 'rgba(59, 130, 246, 0.12)', 
              border: '1px solid rgba(59, 130, 246, 0.3)', 
              borderRadius: '6px', 
              padding: '7px 10px', 
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Zap size={14} color="#60a5fa" />
              <span>
                Order Slicing: <strong>{getFreezeLimit(symbol, orderModal.lotsize).toLocaleString('en-IN')} Qty</strong> allowed per order; <strong>{calculateOrderSlices(symbol, totalQuantity, orderModal.lotsize).length} {isBuy ? 'buy' : 'sell'} orders</strong> will be placed.
              </span>
            </div>
          )}

          {/* Trailing Stop Loss (TSL) Jump Input */}
          {(tab === 'Stop Loss' || isCO || isBO) && (
            <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#60a5fa' }}>
                  📈 Trailing Stop Loss (TSL Jump)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  SL auto-trails upward as LTP advances
                </div>
              </div>
              <div style={{ width: '100px' }}>
                <input 
                  type="number" 
                  step="0.5" 
                  min="0.5" 
                  placeholder="₹ Jump" 
                  value={trailingJump} 
                  onChange={e => setTrailingJump(e.target.value)} 
                  style={{ width: '100%', background: '#0e121a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '5px 8px', color: '#fff', fontSize: '12px', outline: 'none' }} 
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '10px' }}>
            <div 
              onClick={() => openMarketDepthModal(symbol, orderModal.lotsize || 1)}
              style={{ color: '#60a5fa', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}
            >
              Market Depth <Maximize2 size={11} />
            </div>
          </div>
        </div>

        {/* Margin Alert (if insufficient) */}
        {isInsufficient && (
          <div style={{ background: 'rgba(234, 179, 8, 0.1)', borderTop: '1px solid rgba(234, 179, 8, 0.3)', borderBottom: '1px solid rgba(234, 179, 8, 0.3)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#eab308', color: '#000', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>!</div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#fef08a' }}>Insufficient margin!</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Please add ₹{(requiredMargin - balanceNum).toFixed(2)} to place this order.</div>
              </div>
            </div>
            <button style={{ background: '#2563eb', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>ADD FUNDS</button>
          </div>
        )}

        {/* Footer Bar */}
        <div style={{
          background: '#0e121a',
          padding: '12px 18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          {/* Left Info Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '180px' }}>
            {/* Margin Required Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>Margin Required:</span>
              <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#ffffff' }}>
                ₹{requiredMargin.toFixed(2)}
              </span>
              {leverageText && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  color: '#60a5fa',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '3px',
                  padding: '1px 5px',
                  lineHeight: '1.2'
                }}>
                  {leverageText}
                </span>
              )}
            </div>

            {/* Available Margin Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Available:</span>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>
                ₹{balanceNum.toFixed(2)}
              </span>
            </div>
            
            {/* Price Breakup Link */}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '1px' }}>
              <button 
                type="button"
                onClick={() => estimatedTaxes && setShowBreakup(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'transparent',
                  border: 'none',
                  color: '#60a5fa',
                  fontSize: '11.5px',
                  padding: 0,
                  cursor: 'pointer',
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}
              >
                <FileText size={12} /> Price breakup
              </button>
            </div>
          </div>
          
          {/* Right Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            {!isTrueExit && (
              <button 
                type="button"
                onClick={() => {
                  useStore.getState().addToBasket({
                    symbol,
                    side,
                    quantity: parseInt(quantity) || 1,
                    lotsize: orderModal.lotsize || 1,
                    orderType,
                    price: orderType === 'MARKET' ? '' : price
                  });
                  closeOrderModal();
                  useStore.getState().setBasketModalOpen(true);
                }}
                style={{
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  color: '#60a5fa',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap'
                }}
              >
                <ShoppingBag size={13} /> Add to Basket
              </button>
            )}

            <button 
              type="button"
              onClick={handlePlaceOrder}
              disabled={isInsufficient || isPlacing}
              style={{ 
                background: (isInsufficient || isPlacing) ? '#334155' : (isBuy ? '#10b981' : '#ef4444'), 
                color: (isInsufficient || isPlacing) ? '#94a3b8' : '#ffffff', 
                padding: '9px 18px', 
                borderRadius: '6px', 
                fontSize: '12.5px', 
                fontWeight: '800', 
                letterSpacing: '0.3px',
                border: 'none', 
                cursor: (isInsufficient || isPlacing) ? 'not-allowed' : 'pointer', 
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '120px',
                whiteSpace: 'nowrap',
                boxShadow: (isInsufficient || isPlacing) ? 'none' : (isBuy ? '0 0 12px rgba(16, 185, 129, 0.3)' : '0 0 12px rgba(239, 68, 68, 0.3)')
              }}
            >
              {isPlacing ? 'PLACING...' : (
                isTrueExit ? `EXIT ${totalQuantity} Qty` : `${side} ${totalQuantity} Qty`
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Block Intraday Overlay inside Modal */}
      {showIntradayBlockedPopup && (
         <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)', width: '380px', textAlign: 'center', position: 'relative' }}>
               <X size={20} onClick={() => setShowIntradayBlockedPopup(false)} style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--text-secondary)', cursor: 'pointer' }} />
               <X size={48} style={{ color: 'var(--color-red)', marginBottom: '16px' }} />
               <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Intraday Unavailable</h3>
               <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Intraday trading is not available in {symbol.split('-')[0]}</p>
               <button onClick={() => { setProductType('DEL'); setShowIntradayBlockedPopup(false); }} style={{ background: 'var(--color-blue)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '4px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Switch to Delivery</button>
            </div>
         </div>
      )}

      {/* Caution Popup for Restricted Stocks in Delivery */}
      {showCautionPopup && (
         <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
            <div style={{ background: 'var(--bg-dark)', padding: '24px', borderRadius: '8px', border: '1px solid var(--color-red)', width: '420px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--color-red)' }}>
                  <div style={{ background: 'var(--color-red)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>!</div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Caution</h3>
               </div>
               <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px' }}>Security is under the following list of cautions:</p>
               <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '20px', marginBottom: '16px' }}>
                  <li style={{ marginBottom: '8px' }}>Security is under Gross settlement (Trade for Trade)</li>
                  <li>The company is in BZ/SZ series due to non compliance with SEBI SOP Circular</li>
               </ul>
               <div style={{ fontSize: '13px', color: 'var(--color-blue)', cursor: 'pointer', marginBottom: '20px' }}>KNOW MORE</div>
               <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '20px' }}>Would you like to continue?</p>
               <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowCautionPopup(false)} style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 24px', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>NO</button>
                  <button onClick={() => { setShowCautionPopup(false); handlePlaceOrder(); }} style={{ background: 'var(--color-red)', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>YES</button>
               </div>
            </div>
         </div>
      )}

      {/* Charges Breakup Modal */}
      {showBreakup && estimatedTaxes && (
         <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30 }}>
            <div style={{ background: 'var(--bg-panel)', borderRadius: '8px', width: '380px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <FileText size={18} />
                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Charges</h3>
                  </div>
                  <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowBreakup(false)} />
               </div>
               
               <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '16px', color: 'var(--text-primary)' }}>
                     <span>Brokerage {calculateOrderSlices(symbol, totalQuantity, orderModal.lotsize).length > 1 ? `(${calculateOrderSlices(symbol, totalQuantity, orderModal.lotsize).length} sliced orders)` : ''}</span>
                     <span>₹{estimatedTaxes.brokerage.toFixed(2)}</span>
                  </div>
                  
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>Others</div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                     <span>Transaction (Exch. + Clearing)</span>
                     <span>₹{estimatedTaxes.exchangeCharge.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                     <span>CTT/STT</span>
                     <span>₹{estimatedTaxes.stt.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                      <span>CGST (9%)</span>
                      <span>₹{(estimatedTaxes.cgst !== undefined ? estimatedTaxes.cgst : (estimatedTaxes.gst / 2)).toFixed(2)}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                      <span>SGST (9%)</span>
                      <span>₹{(estimatedTaxes.sgst !== undefined ? estimatedTaxes.sgst : (estimatedTaxes.gst / 2)).toFixed(2)}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                      <span>SEBI</span>
                      <span>₹{estimatedTaxes.sebiCharge.toFixed(2)}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                      <span>Stamp duty</span>
                      <span>₹{estimatedTaxes.stampDuty.toFixed(2)}</span>
                   </div>
                   {estimatedTaxes.dpCharge > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                         <span>DP Charge</span>
                         <span>₹{estimatedTaxes.dpCharge.toFixed(2)}</span>
                      </div>
                   )}
                   {isMutualFund && (
                      <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(59,130,246,0.08)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.2)' }}>
                         <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-blue-light)', marginBottom: '4px' }}>Mutual Fund Capital Gains Tax (STCG / LTCG):</div>
                         <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                            • <strong>STCG (≤ 12 mos):</strong> 20% on profit<br />
                            • <strong>LTCG (&gt; 12 mos):</strong> 12.5% on profit (first ₹1.25L/yr exempt)<br />
                            • <strong>Debt Funds:</strong> 1% on profit
                         </div>
                      </div>
                   )}
               </div>
               
               <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
                     <span>Total</span>
                     <span>₹{estimatedTaxes.totalTaxes.toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                     *Actual charges may vary based on order execution. <span style={{ color: 'var(--color-blue)', cursor: 'pointer' }}>Learn more</span>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}



