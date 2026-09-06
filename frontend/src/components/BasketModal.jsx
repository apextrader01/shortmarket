import React, { useState, useEffect, useRef } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { X, Trash2, ShoppingBag, Search, Plus } from 'lucide-react';

function extractOptionStrike(symbol) {
  if (!symbol) return 0;
  const clean = symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
  
  // Format 1: Monthly format with 3-letter month e.g. NIFTY26SEP24550CE
  const monthlyMatch = clean.match(/^[A-Z]+\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d+)(CE|PE)$/i);
  if (monthlyMatch) return parseFloat(monthlyMatch[2]);

  // Format 2: Weekly expiry e.g. NIFTY2690824200PE (Year 26, Month 1-9/O/N/D, Day 08, Strike 24200)
  const weeklyMatch = clean.match(/^[A-Z]+\d{2}[1-9OND]\d{2}(\d+)(CE|PE)$/i);
  if (weeklyMatch) return parseFloat(weeklyMatch[1]);

  // Format 3: Commodity / other derivative: 3-letter month followed by strike digits
  const monthMatch = clean.match(/[A-Z]{3}(\d+)(CE|PE)$/i);
  if (monthMatch) return parseFloat(monthMatch[1]);

  // Format 4: General fallback
  const generalMatch = clean.match(/(\d+)(CE|PE)$/i);
  if (generalMatch) {
    let s = generalMatch[1];
    if (s.length > 5) s = s.slice(-5);
    return parseFloat(s);
  }
  return 0;
}

export default function BasketModal() {
  const { basketModalOpen, setBasketModalOpen, basketItems, addToBasket, removeFromBasket, updateBasketItem, placeBasketOrder, prices, user, restrictedStocks, marketStatus, marketCalendar } = useStore(useShallow(state => ({ basketModalOpen: state.basketModalOpen, setBasketModalOpen: state.setBasketModalOpen, basketItems: state.basketItems, addToBasket: state.addToBasket, removeFromBasket: state.removeFromBasket, updateBasketItem: state.updateBasketItem, placeBasketOrder: state.placeBasketOrder, prices: state.prices, user: state.user, restrictedStocks: state.restrictedStocks, marketStatus: state.marketStatus, marketCalendar: state.marketCalendar })));

  const [productType, setProductType] = useState('INT');
  const [showCautionPopup, setShowCautionPopup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Auto-subscribe to socket feed and fetch batch prices whenever basket opens or items change
  useEffect(() => {
    if (!basketModalOpen || basketItems.length === 0) return;
    const symbols = basketItems.map(i => i.symbol).filter(Boolean);
    symbols.forEach(sym => {
      useStore.getState().subscribeToSymbol?.(sym);
    });
    if (useStore.getState().fetchBatchPrices) {
      useStore.getState().fetchBatchPrices(symbols);
    }
  }, [basketModalOpen, basketItems]);

  // Quick Search for any stock / derivative to add directly into the basket
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${API}/api/stocks/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.slice(0, 6));
        }
      } catch (e) {
        console.error('Basket search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!basketModalOpen) return null;

  const balanceNum = Number(user?.balance) || 0;

  // Enhance basket items with live price and calculated individual margin
  const enhancedItems = basketItems.map(item => {
    const symbol = item.symbol;
    const livePrice = symbol ? (prices[symbol]?.ltp || 0) : 0;
    const cleanSym = symbol ? (symbol.includes(':') ? symbol.split(':')[1] : symbol) : '';
    const isOption = /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(cleanSym);
    const optionStrike = isOption ? extractOptionStrike(symbol) : 0;
    const typeStr = isOption ? (/(?:\d+|[-_\s])CE/i.test(cleanSym) || cleanSym.endsWith('CE') ? 'CE' : 'PE') : 'OTHER';
    const totalQuantity = item.quantity * (item.lotsize || 1);
    
    return {
      ...item,
      livePrice,
      optionStrike,
      isOption,
      typeStr,
      totalQuantity
    };
  });

  // Calculate Margin with Hedging Benefit
  let requiredMargin = 0;

  // Separate legs
  const buys = enhancedItems.filter(item => item.side === 'BUY');
  const sells = enhancedItems.filter(item => item.side === 'SELL');

  let totalPremiumPaid = 0;
  let unhedgedSells = [...sells];
  let hedgedMargin = 0;

  buys.forEach(buy => {
    const premium = buy.totalQuantity * (buy.orderType === 'MARKET' ? buy.livePrice : parseFloat(buy.price || 0));
    totalPremiumPaid += premium;

    // Try to pair with a sell of the SAME TYPE (CE with CE, PE with PE)
    if (buy.isOption && buy.optionStrike > 0) {
      const pairIndex = unhedgedSells.findIndex(sell => sell.isOption && sell.typeStr === buy.typeStr && sell.optionStrike > 0);
      if (pairIndex !== -1) {
        const sell = unhedgedSells[pairIndex];
        // Calculate max loss for the spread
        const strikeDiff = Math.abs(sell.optionStrike - buy.optionStrike);
        // We use min quantity to hedge
        const hedgedQty = Math.min(buy.totalQuantity, sell.totalQuantity);
        
        hedgedMargin += strikeDiff * hedgedQty;
        
        // Remove from unhedged list
        unhedgedSells.splice(pairIndex, 1);
      }
    }
  });

  unhedgedSells.forEach(sell => {
    const isIndex = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCPNIFTY'].some(idx => sell.symbol.includes(idx));
    let baseMargin = 0;
    const premium = sell.totalQuantity * (sell.orderType === 'MARKET' ? sell.livePrice : parseFloat(sell.price || 0));

    if (sell.isOption) {
      const marginRate = isIndex ? 0.10 : 0.20; 
      if (sell.optionStrike > 0) {
        const grossMargin = sell.optionStrike * sell.totalQuantity * marginRate;
        baseMargin = Math.max(grossMargin - premium, 0); 
      } else {
        baseMargin = sell.totalQuantity * (isIndex ? 4000 : 8000);
      }
    } else if (sell.symbol.includes('FUT')) {
      const marginRate = isIndex ? 0.10 : 0.15;
      baseMargin = sell.totalQuantity * (sell.orderType === 'MARKET' ? sell.livePrice : parseFloat(sell.price || 0)) * marginRate;
    } else {
      baseMargin = sell.totalQuantity * (sell.orderType === 'MARKET' ? sell.livePrice : parseFloat(sell.price || 0));
    }
    
    const leverageMultiplier = (productType === 'INT' && !sell.isOption) ? 0.25 : 1.0;
    requiredMargin += (baseMargin * leverageMultiplier);
  });

  let finalMargin = hedgedMargin + requiredMargin + totalPremiumPaid;
  
  // Intraday leverage for non-options buys
  buys.forEach(buy => {
    if (!buy.isOption && productType === 'INT') {
      const premium = buy.totalQuantity * (buy.orderType === 'MARKET' ? buy.livePrice : parseFloat(buy.price || 0));
      finalMargin -= premium;
      finalMargin += premium * 0.25;
    }
  });

  const isInsufficient = balanceNum < finalMargin;

  // Check market session restrictions and cutoff
  let blockedMarketReason = null;
  const isMarketBlocked = enhancedItems.some(item => {
    const clean = (item.symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
    const isCommodity = (item.symbol || '').includes('MCX') || ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'].some(c => clean.startsWith(c));
    const status = isCommodity ? (marketStatus?.commodity || 'AUTO') : (marketStatus?.equity || 'AUTO');
    
    if (status === 'OPEN') return false;
    if (status === 'CLOSED') {
      blockedMarketReason = `${isCommodity ? 'MCX Commodity' : 'NSE/BSE Equity'} market is currently marked CLOSED / Holiday by Administrator.`;
      return true;
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
        blockedMarketReason = `${isCommodity ? 'MCX Commodity' : 'NSE/BSE Equity'} market is CLOSED today (${holidayReason}).`;
        return true;
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
          blockedMarketReason = `Today's special session for ${isCommodity ? 'MCX' : 'NSE/BSE'} (${holidayReason}) is open only between ${startTimeStr} and ${endTimeStr} IST.`;
          return true;
        }
        return false;
      }
    }

    // 2. AUTO mode: Check weekend & normal hours
    const day = istTime.getDay();
    if (day === 0 || day === 6) {
      blockedMarketReason = 'Markets are closed on weekends (Saturday & Sunday).';
      return true;
    }
    
    if (productType === 'INT') {
      const hours = istTime.getHours();
      const minutes = istTime.getMinutes();
      if (isCommodity) {
        const isClosed = hours < 9 || hours > 22 || (hours === 22 && minutes >= 50);
        if (isClosed) blockedMarketReason = 'Intraday trading for Commodities is allowed only between 9:00 AM and 10:50 PM IST.';
        return isClosed;
      } else {
        const isClosed = hours < 9 || (hours === 9 && minutes < 15) || hours > 15 || (hours === 15 && minutes >= 15);
        if (isClosed) blockedMarketReason = 'Intraday trading for Equities is allowed only between 9:15 AM and 3:15 PM IST.';
        return isClosed;
      }
    }
    return false;
  });

  const isAnyRestricted = enhancedItems.some(item => restrictedStocks.includes(item.symbol));
  const isIntradayBlocked = (isAnyRestricted || isMarketBlocked) && productType === 'INT';

  const handleExecute = async () => {
    if (basketItems.length === 0) return;
    if (isMarketBlocked) {
      alert(blockedMarketReason || 'Market is currently closed for one or more items in the basket.');
      return;
    }
    if (isIntradayBlocked) return;
    if (isAnyRestricted && !showCautionPopup) {
       setShowCautionPopup(true);
       return;
    }

    setIsSubmitting(true);
    const payload = {
      total_margin: finalMargin,
      items: enhancedItems.map(item => ({
        symbol: item.symbol,
        type: item.orderType,
        side: item.side,
        quantity: item.totalQuantity,
        price: item.orderType === 'MARKET' ? item.livePrice : parseFloat(item.price),
        product_type: productType,
        margin: 0
      }))
    };

    const success = await placeBasketOrder(payload);
    setIsSubmitting(false);
    if (!success) {
      alert("Failed to place basket orders. Please try again.");
    }
  };

  const applyPreset = (type) => {
    const atmPrice = prices['NSE:NIFTY50-INDEX']?.ltp || prices['NSE:NIFTY50']?.ltp || 24400;
    const roundedStrike = Math.round(atmPrice / 50) * 50;

    const now = new Date();
    const yr = String(now.getFullYear()).slice(-2);
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const mo = months[now.getMonth()];
    const symPrefix = `NSE:NIFTY${yr}${mo}`;

    let newItems = [];
    if (type === 'BULL_CALL_SPREAD') {
      newItems = [
        { symbol: `${symPrefix}${roundedStrike}CE`, side: 'BUY', quantity: 1, lotsize: 25, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike + 100}CE`, side: 'SELL', quantity: 1, lotsize: 25, orderType: 'MARKET', price: '' }
      ];
    } else if (type === 'BEAR_PUT_SPREAD') {
      newItems = [
        { symbol: `${symPrefix}${roundedStrike}PE`, side: 'BUY', quantity: 1, lotsize: 25, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike - 100}PE`, side: 'SELL', quantity: 1, lotsize: 25, orderType: 'MARKET', price: '' }
      ];
    } else if (type === 'STRADDLE') {
      newItems = [
        { symbol: `${symPrefix}${roundedStrike}CE`, side: 'SELL', quantity: 1, lotsize: 25, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike}PE`, side: 'SELL', quantity: 1, lotsize: 25, orderType: 'MARKET', price: '' }
      ];
    } else if (type === 'STRANGLE') {
      newItems = [
        { symbol: `${symPrefix}${roundedStrike + 150}CE`, side: 'SELL', quantity: 1, lotsize: 25, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike - 150}PE`, side: 'SELL', quantity: 1, lotsize: 25, orderType: 'MARKET', price: '' }
      ];
    } else if (type === 'IRON_CONDOR') {
      newItems = [
        { symbol: `${symPrefix}${roundedStrike + 200}CE`, side: 'BUY', quantity: 1, lotsize: 25, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike + 100}CE`, side: 'SELL', quantity: 1, lotsize: 25, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike - 100}PE`, side: 'SELL', quantity: 1, lotsize: 25, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike - 200}PE`, side: 'BUY', quantity: 1, lotsize: 25, orderType: 'MARKET', price: '' }
      ];
    }

    useStore.setState({ basketItems: newItems });
    newItems.forEach(i => {
      useStore.getState().subscribeToSymbol?.(i.symbol);
    });
    if (useStore.getState().fetchBatchPrices) {
      useStore.getState().fetchBatchPrices(newItems.map(i => i.symbol));
    }
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        width: '680px', background: 'var(--bg-dark)', borderRadius: '10px', 
        border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', maxHeight: '85vh'
      }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={20} color="var(--color-blue)" />
            <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>Basket & Multi-Leg Strategy Builder ({basketItems.length})</h2>
          </div>
          <button onClick={() => setBasketModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* 1-Click Strategy Presets Bar */}
        <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center', overflowX: 'auto' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', whiteSpace: 'nowrap' }}>1-CLICK PRESETS:</span>
          <button type="button" onClick={() => applyPreset('BULL_CALL_SPREAD')} style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>🐂 Bull Call Spread</button>
          <button type="button" onClick={() => applyPreset('BEAR_PUT_SPREAD')} style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>🐻 Bear Put Spread</button>
          <button type="button" onClick={() => applyPreset('STRADDLE')} style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--color-blue-light)', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>⚡ Straddle</button>
          <button type="button" onClick={() => applyPreset('STRANGLE')} style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>🎯 Strangle</button>
          <button type="button" onClick={() => applyPreset('IRON_CONDOR')} style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>🦅 Iron Condor</button>
        </div>

        {/* Product Type Selection */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Product Type:</span>
            <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
              <div onClick={() => setProductType('INT')} style={{ width: '60px', textAlign: 'center', padding: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: productType === 'INT' ? 'rgba(34, 197, 94, 0.1)' : 'transparent', color: productType === 'INT' ? 'var(--color-green-light)' : 'var(--text-primary)' }}>INT</div>
              <div onClick={() => setProductType('DEL')} style={{ width: '60px', textAlign: 'center', padding: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: productType === 'DEL' ? 'rgba(34, 197, 94, 0.1)' : 'transparent', color: productType === 'DEL' ? 'var(--color-green-light)' : 'var(--text-primary)' }}>DEL</div>
            </div>
          </div>
          {hedgedMargin > 0 && (
            <div style={{ fontSize: '11.5px', color: '#4ade80', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', padding: '4px 10px', borderRadius: '12px', fontWeight: '700' }}>
              🛡️ Hedge Benefit Applied (Margin Discount)
            </div>
          )}
        </div>

        {/* Search & Add Any Stock/Option to Basket */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 12px' }}>
            <Search size={14} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="Search & add any stock, futures, or option to basket (e.g. RELIANCE, NIFTY, TCS)..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '12.5px', outline: 'none', flex: 1 }}
            />
            {searchQuery && (
              <X size={14} color="var(--text-secondary)" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: '20px', right: '20px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
              {searchResults.map((stk, sIdx) => (
                <div key={sIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#fff' }}>{stk.uniqueSymbol || stk.symbol}</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{stk.name || stk.exchange} • Lot: {stk.lotsize || 1}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      type="button" 
                      onClick={() => {
                        addToBasket({ symbol: stk.uniqueSymbol || stk.symbol, side: 'BUY', quantity: 1, lotsize: stk.lotsize || 1, orderType: 'MARKET', price: '' });
                        setSearchQuery('');
                        setSearchResults([]);
                      }} 
                      style={{ padding: '4px 10px', borderRadius: '4px', background: 'var(--color-blue)', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      + BUY
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        addToBasket({ symbol: stk.uniqueSymbol || stk.symbol, side: 'SELL', quantity: 1, lotsize: stk.lotsize || 1, orderType: 'MARKET', price: '' });
                        setSearchQuery('');
                        setSearchResults([]);
                      }} 
                      style={{ padding: '4px 10px', borderRadius: '4px', background: 'var(--color-red)', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      + SELL
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Item List */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {basketItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>Your basket is empty.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {enhancedItems.map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', padding: '12px', background: 'var(--bg-panel)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '8px', height: '40px', background: item.side === 'BUY' ? 'var(--color-blue)' : 'var(--color-red)', borderRadius: '4px', marginRight: '12px' }}></div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>{item.symbol}</div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span style={{ color: item.side === 'BUY' ? 'var(--color-blue)' : 'var(--color-red)' }}>{item.side}</span>
                      <span>•</span>
                      <span>Qty: {item.quantity} {item.lotsize > 1 ? `x ${item.lotsize}` : ''}</span>
                    </div>
                  </div>

                  <div style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '4px', marginRight: '16px' }}>
                    <select 
                      value={item.orderType} 
                      onChange={(e) => updateBasketItem(index, { orderType: e.target.value })}
                      style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px', borderRadius: '4px', fontSize: '12px', width: '100%', outline: 'none' }}
                    >
                      <option value="MARKET">Market</option>
                      <option value="LIMIT">Limit</option>
                    </select>
                    {item.orderType === 'LIMIT' && (
                      <input 
                        type="number" 
                        value={item.price} 
                        onChange={(e) => updateBasketItem(index, { price: e.target.value })}
                        style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px', borderRadius: '4px', fontSize: '12px', width: '100%', outline: 'none' }}
                      />
                    )}
                  </div>

                  <div style={{ textAlign: 'right', width: '80px', marginRight: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>LTP</div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>₹{item.livePrice.toFixed(2)}</div>
                  </div>

                  <button onClick={() => removeFromBasket(index)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
           {isInsufficient && basketItems.length > 0 && (
            <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '8px 12px', borderRadius: '4px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'var(--color-yellow)', color: '#000', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>!</div>
              <div style={{ fontSize: '12px', color: '#fef08a' }}>Insufficient margin! Shortfall: ₹{(finalMargin - balanceNum).toFixed(2)}</div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '32px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Available Balance</div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>₹{balanceNum.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-blue)', marginBottom: '4px' }}>Combined Margin</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-blue)' }}>₹{finalMargin.toFixed(2)}</div>
              </div>
            </div>
            <button 
              onClick={handleExecute}
              disabled={isInsufficient || isSubmitting || basketItems.length === 0}
              style={{ 
                background: (isInsufficient || basketItems.length === 0) ? 'var(--bg-panel)' : 'var(--color-blue)', 
                color: (isInsufficient || basketItems.length === 0) ? 'var(--text-secondary)' : '#fff', 
                padding: '12px 24px', borderRadius: '4px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px',
                border: 'none', cursor: (isInsufficient || basketItems.length === 0) ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease'
              }}
            >
              {isSubmitting ? 'EXECUTING...' : 'EXECUTE BASKET'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}


