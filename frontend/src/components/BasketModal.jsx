import React, { useState, useEffect, useRef } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { X, Trash2, ShoppingBag, Search, Plus } from 'lucide-react';
import { getInstantLotsize, isCommodityContract } from '../utils/lotsizeHelper';

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

const INDICES_LIST = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 'MIDCPNIFTY', 'BANKEX'];
const MCX_LIST = ['CRUDEOIL', 'NATURALGAS', 'GOLD', 'SILVER', 'COPPER', 'ZINC', 'ALUMINIUM', 'LEAD'];
const POPULAR_STOCKS_LIST = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'SBIN', 'ICICIBANK', 'TATAMOTORS', 'BAJFINANCE', 'BHARTIARTL', 'ITC', 'KOTAKBANK', 'LT', 'AXISBANK'];

export default function BasketModal() {
  const { basketModalOpen, setBasketModalOpen, basketItems, addToBasket, removeFromBasket, updateBasketItem, placeBasketOrder, prices, user, restrictedStocks, marketStatus, marketCalendar } = useStore(useShallow(state => ({ basketModalOpen: state.basketModalOpen, setBasketModalOpen: state.setBasketModalOpen, basketItems: state.basketItems, addToBasket: state.addToBasket, removeFromBasket: state.removeFromBasket, updateBasketItem: state.updateBasketItem, placeBasketOrder: state.placeBasketOrder, prices: state.prices, user: state.user, restrictedStocks: state.restrictedStocks, marketStatus: state.marketStatus, marketCalendar: state.marketCalendar })));

  const [productType, setProductType] = useState('INT');
  const [showCautionPopup, setShowCautionPopup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUnderlying, setSelectedUnderlying] = useState('NIFTY');

  const [underlyingCategory, setUnderlyingCategory] = useState('ALL'); // 'ALL' | 'INDICES' | 'MCX' | 'STOCKS'
  const [underlyingSearch, setUnderlyingSearch] = useState('');
  const [showUnderlyingDropdown, setShowUnderlyingDropdown] = useState(false);
  const [allAvailableUnderlyings, setAllAvailableUnderlyings] = useState([]);
  const underlyingDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (underlyingDropdownRef.current && !underlyingDropdownRef.current.contains(e.target)) {
        setShowUnderlyingDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const res = await fetch(`${API}/api/options/symbols`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setAllAvailableUnderlyings(data);
          }
        }
      } catch (e) {
        console.error('Failed to fetch option symbols for BasketModal:', e);
      }
    };
    fetchSymbols();
  }, []);

  // Auto-subscribe to spot/index feed for selected underlying
  useEffect(() => {
    if (!basketModalOpen) return;
    const isMCX = MCX_LIST.includes(selectedUnderlying) || isCommodityContract(selectedUnderlying);
    const isBSE = selectedUnderlying === 'SENSEX' || selectedUnderlying === 'BANKEX';
    let key = null;
    if (selectedUnderlying === 'NIFTY') key = 'NSE:NIFTY50-INDEX';
    else if (selectedUnderlying === 'BANKNIFTY') key = 'NSE:NIFTYBANK-INDEX';
    else if (selectedUnderlying === 'FINNIFTY') key = 'NSE:FINNIFTY-INDEX';
    else if (selectedUnderlying === 'SENSEX') key = 'BSE:SENSEX-INDEX';
    else if (selectedUnderlying === 'MIDCPNIFTY') key = 'NSE:MIDCPNIFTY-INDEX';
    else if (selectedUnderlying === 'BANKEX') key = 'BSE:BANKEX-INDEX';
    else if (!isMCX) key = `${isBSE ? 'BSE' : 'NSE'}:${selectedUnderlying}-EQ`;
    
    if (key) {
      useStore.getState().subscribeToSymbol?.(key);
      useStore.getState().fetchBatchPrices?.([key]);
    }
  }, [basketModalOpen, selectedUnderlying]);

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
    const effectiveLotsize = (item.lotsize && Number(item.lotsize) > 1) ? Number(item.lotsize) : (getInstantLotsize(symbol) || 1);
    const totalQuantity = (Number(item.quantity) || 1) * effectiveLotsize;
    
    return {
      ...item,
      lotsize: effectiveLotsize,
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

  const getUnderlyingType = (sym) => {
    if (INDICES_LIST.includes(sym)) return 'INDEX';
    if (MCX_LIST.includes(sym) || isCommodityContract(sym)) return 'MCX';
    return 'STOCK';
  };

  const getPillsForCategory = () => {
    if (underlyingCategory === 'INDICES') return INDICES_LIST;
    if (underlyingCategory === 'MCX') return MCX_LIST;
    if (underlyingCategory === 'STOCKS') return POPULAR_STOCKS_LIST;
    return ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 'CRUDEOIL', 'NATURALGAS', 'GOLD', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'SBIN'];
  };

  const masterList = allAvailableUnderlyings.length > 0 
    ? allAvailableUnderlyings 
    : Array.from(new Set([...INDICES_LIST, ...MCX_LIST, ...POPULAR_STOCKS_LIST]));

  const filteredUnderlyings = masterList.filter(sym => {
    const matchesSearch = !underlyingSearch.trim() || sym.toLowerCase().includes(underlyingSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (underlyingCategory === 'INDICES') return INDICES_LIST.includes(sym);
    if (underlyingCategory === 'MCX') return MCX_LIST.includes(sym) || isCommodityContract(sym);
    if (underlyingCategory === 'STOCKS') return !INDICES_LIST.includes(sym) && !MCX_LIST.includes(sym) && !isCommodityContract(sym);
    return true;
  });

  const applyPreset = (type, customUnderlying = null) => {
    const targetUnderlying = customUnderlying || selectedUnderlying;
    const isMCX = MCX_LIST.includes(targetUnderlying) || isCommodityContract(targetUnderlying);
    const isBSE = targetUnderlying === 'SENSEX' || targetUnderlying === 'BANKEX';
    const exch = isMCX ? 'MCX' : (isBSE ? 'BSE' : 'NSE');

    let indexKey = null;
    if (targetUnderlying === 'NIFTY') indexKey = 'NSE:NIFTY50-INDEX';
    else if (targetUnderlying === 'BANKNIFTY') indexKey = 'NSE:NIFTYBANK-INDEX';
    else if (targetUnderlying === 'FINNIFTY') indexKey = 'NSE:FINNIFTY-INDEX';
    else if (targetUnderlying === 'SENSEX') indexKey = 'BSE:SENSEX-INDEX';
    else if (targetUnderlying === 'MIDCPNIFTY') indexKey = 'NSE:MIDCPNIFTY-INDEX';
    else if (targetUnderlying === 'BANKEX') indexKey = 'BSE:BANKEX-INDEX';
    else if (!isMCX) indexKey = `NSE:${targetUnderlying}-EQ`;

    const liveSpot = (indexKey && prices[indexKey]?.ltp) || prices[`${exch}:${targetUnderlying}`]?.ltp || prices[`NSE:${targetUnderlying}`]?.ltp || prices[`BSE:${targetUnderlying}`]?.ltp || 0;

    const fallbackSpots = {
      'NIFTY': 24000,
      'BANKNIFTY': 51500,
      'FINNIFTY': 24000,
      'SENSEX': 76500,
      'MIDCPNIFTY': 12500,
      'BANKEX': 57000,
      'CRUDEOIL': 6500,
      'NATURALGAS': 220,
      'GOLD': 72000,
      'SILVER': 85000,
      'COPPER': 800,
      'ZINC': 270,
      'ALUMINIUM': 230,
      'RELIANCE': 1450,
      'TCS': 2300,
      'HDFCBANK': 710,
      'INFY': 1850,
      'SBIN': 820,
      'ICICIBANK': 1250,
      'TATAMOTORS': 980
    };

    const spotPrice = liveSpot > 0 ? liveSpot : (fallbackSpots[targetUnderlying] || 1000);

    let step = 50;
    if (targetUnderlying === 'BANKNIFTY' || targetUnderlying === 'SENSEX' || targetUnderlying === 'BANKEX') step = 100;
    else if (targetUnderlying === 'MIDCPNIFTY') step = 25;
    else if (targetUnderlying === 'NIFTY' || targetUnderlying === 'FINNIFTY' || targetUnderlying === 'CRUDEOIL') step = 50;
    else if (targetUnderlying === 'NATURALGAS') step = 5;
    else if (targetUnderlying === 'GOLD') step = 100;
    else if (targetUnderlying === 'SILVER') step = 250;
    else if (targetUnderlying === 'COPPER' || targetUnderlying === 'ZINC' || targetUnderlying === 'ALUMINIUM') step = 5;
    else {
      if (spotPrice > 3000) step = 50;
      else if (spotPrice > 1500) step = 20;
      else if (spotPrice > 500) step = 10;
      else if (spotPrice > 200) step = 5;
      else step = 2.5;
    }

    const roundedStrike = Math.round(spotPrice / step) * step;
    const lotsize = getInstantLotsize(targetUnderlying) || 1;

    const now = new Date();
    const yr = String(now.getFullYear()).slice(-2);
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const mo = months[now.getMonth()];
    const symPrefix = `${exch}:${targetUnderlying}${yr}${mo}`;

    let newItems = [];
    if (type === 'BULL_CALL_SPREAD') {
      newItems = [
        { symbol: `${symPrefix}${roundedStrike}CE`, side: 'BUY', quantity: 1, lotsize, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike + (step * 2)}CE`, side: 'SELL', quantity: 1, lotsize, orderType: 'MARKET', price: '' }
      ];
    } else if (type === 'BEAR_PUT_SPREAD') {
      newItems = [
        { symbol: `${symPrefix}${roundedStrike}PE`, side: 'BUY', quantity: 1, lotsize, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike - (step * 2)}PE`, side: 'SELL', quantity: 1, lotsize, orderType: 'MARKET', price: '' }
      ];
    } else if (type === 'STRADDLE') {
      newItems = [
        { symbol: `${symPrefix}${roundedStrike}CE`, side: 'SELL', quantity: 1, lotsize, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike}PE`, side: 'SELL', quantity: 1, lotsize, orderType: 'MARKET', price: '' }
      ];
    } else if (type === 'STRANGLE') {
      newItems = [
        { symbol: `${symPrefix}${roundedStrike + (step * 3)}CE`, side: 'SELL', quantity: 1, lotsize, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike - (step * 3)}PE`, side: 'SELL', quantity: 1, lotsize, orderType: 'MARKET', price: '' }
      ];
    } else if (type === 'IRON_CONDOR') {
      newItems = [
        { symbol: `${symPrefix}${roundedStrike + (step * 4)}CE`, side: 'BUY', quantity: 1, lotsize, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike + (step * 2)}CE`, side: 'SELL', quantity: 1, lotsize, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike - (step * 2)}PE`, side: 'SELL', quantity: 1, lotsize, orderType: 'MARKET', price: '' },
        { symbol: `${symPrefix}${roundedStrike - (step * 4)}PE`, side: 'BUY', quantity: 1, lotsize, orderType: 'MARKET', price: '' }
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

        {/* Underlying Asset Filter & Search Bar */}
        <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Controls Header: Category Tabs + Search Input */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            
            {/* Category Tabs */}
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              {['ALL', 'INDICES', 'MCX', 'STOCKS'].map(cat => {
                const isActive = underlyingCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setUnderlyingCategory(cat)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '4px',
                      background: isActive ? 'var(--color-blue)' : 'transparent',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      fontSize: '10.5px',
                      fontWeight: isActive ? '700' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Search Underlying Dropdown Box */}
            <div ref={underlyingDropdownRef} style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '300px' }}>
              <div 
                onClick={() => setShowUnderlyingDropdown(true)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '6px', 
                  background: 'var(--bg-panel)', border: '1px solid var(--border-color)', 
                  borderRadius: '6px', padding: '4px 10px', cursor: 'text' 
                }}
              >
                <Search size={13} color="var(--text-secondary)" />
                <input 
                  type="text" 
                  placeholder="Search all F&O / MCX..." 
                  value={underlyingSearch} 
                  onFocus={() => setShowUnderlyingDropdown(true)}
                  onChange={e => {
                    setUnderlyingSearch(e.target.value);
                    setShowUnderlyingDropdown(true);
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '11.5px', outline: 'none', flex: 1 }}
                />
                {underlyingSearch && (
                  <X size={13} color="var(--text-secondary)" style={{ cursor: 'pointer' }} onClick={() => setUnderlyingSearch('')} />
                )}
              </div>

              {/* Floating Dropdown Results */}
              {showUnderlyingDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  maxHeight: '220px', overflowY: 'auto',
                  background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
                  borderRadius: '6px', marginTop: '4px', zIndex: 100,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.8)'
                }}>
                  {filteredUnderlyings.length > 0 ? (
                    filteredUnderlyings.map(sym => {
                      const type = getUnderlyingType(sym);
                      const lot = getInstantLotsize(sym);
                      const isSel = selectedUnderlying === sym;
                      return (
                        <div
                          key={sym}
                          onClick={() => {
                            setSelectedUnderlying(sym);
                            setShowUnderlyingDropdown(false);
                            setUnderlyingSearch('');
                          }}
                          style={{
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            background: isSel ? 'rgba(59,130,246,0.15)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.1s ease'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={e => e.currentTarget.style.background = isSel ? 'rgba(59,130,246,0.15)' : 'transparent'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: isSel ? '#60a5fa' : '#fff' }}>{sym}</span>
                            <span style={{ 
                              fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', fontWeight: '700',
                              background: type === 'INDEX' ? 'rgba(59,130,246,0.2)' : (type === 'MCX' ? 'rgba(245,158,11,0.2)' : 'rgba(168,85,247,0.2)'),
                              color: type === 'INDEX' ? '#60a5fa' : (type === 'MCX' ? '#fbbf24' : '#c084fc')
                            }}>
                              {type}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Lot: {lot}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '12px', textAlign: 'center', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      No matching underlyings found
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Quick Selection Pills */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', overflowX: 'auto', paddingBottom: '2px' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: '700', whiteSpace: 'nowrap', marginRight: '2px' }}>QUICK SELECT:</span>
            {getPillsForCategory().map(sym => {
              const isSel = selectedUnderlying === sym;
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setSelectedUnderlying(sym)}
                  style={{
                    padding: '3px 9px',
                    borderRadius: '12px',
                    background: isSel ? 'var(--color-blue)' : 'rgba(255,255,255,0.06)',
                    border: isSel ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                    color: isSel ? '#fff' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: isSel ? '700' : '500',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {sym}
                </button>
              );
            })}
          </div>

        </div>

        {/* 1-Click Strategy Presets Bar */}
        <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.015)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center', overflowX: 'auto' }}>
          <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: '800', whiteSpace: 'nowrap' }}>⚡ {selectedUnderlying} PRESETS:</span>
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
              {searchResults.map((stk, sIdx) => {
                const sym = stk.uniqueSymbol || stk.symbol;
                const effectiveLotsize = (stk.lotsize && Number(stk.lotsize) > 1) ? Number(stk.lotsize) : getInstantLotsize(sym);
                return (
                  <div key={sIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#fff' }}>{sym}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{stk.name || stk.exchange} • Lot: {effectiveLotsize}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        type="button" 
                        onClick={() => {
                          addToBasket({ symbol: sym, side: 'BUY', quantity: 1, lotsize: effectiveLotsize, orderType: 'MARKET', price: '' });
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
                          addToBasket({ symbol: sym, side: 'SELL', quantity: 1, lotsize: effectiveLotsize, orderType: 'MARKET', price: '' });
                          setSearchQuery('');
                          setSearchResults([]);
                        }} 
                        style={{ padding: '4px 10px', borderRadius: '4px', background: 'var(--color-red)', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        + SELL
                      </button>
                    </div>
                  </div>
                );
              })}
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
                <div key={index} style={{ display: 'flex', alignItems: 'center', padding: '12px', background: 'var(--bg-panel)', borderRadius: '6px', border: '1px solid var(--border-color)', gap: '12px' }}>
                  {/* Side Switch Button */}
                  <button
                    type="button"
                    onClick={() => updateBasketItem(index, { side: item.side === 'BUY' ? 'SELL' : 'BUY' })}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '4px',
                      background: item.side === 'BUY' ? 'var(--color-blue)' : 'var(--color-red)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                    title="Click to toggle BUY / SELL"
                  >
                    {item.side === 'BUY' ? 'B' : 'S'}
                  </button>
                  
                  {/* Symbol Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '700', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.symbol}</div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      <span style={{ color: item.side === 'BUY' ? 'var(--color-blue)' : 'var(--color-red)', fontWeight: '600' }}>{item.side}</span>
                      <span>•</span>
                      <span>Total Qty: {item.totalQuantity}</span>
                    </div>
                  </div>

                  {/* Lots Input */}
                  <div style={{ width: '75px', flexShrink: 0 }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '3px' }}>Lots (×{item.lotsize || 1})</div>
                    <input 
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity || 1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        updateBasketItem(index, { quantity: isNaN(val) || val < 1 ? 1 : val });
                      }}
                      style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '5px 8px', borderRadius: '4px', fontSize: '12px', width: '100%', outline: 'none' }}
                    />
                  </div>

                  {/* Order Type & Limit Price */}
                  <div style={{ width: '130px', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                    <select 
                      value={item.orderType} 
                      onChange={(e) => {
                        const newType = e.target.value;
                        const defaultPrice = (item.price || (item.livePrice > 0 ? item.livePrice.toFixed(2) : ''));
                        updateBasketItem(index, { 
                          orderType: newType,
                          price: newType === 'LIMIT' ? defaultPrice : ''
                        });
                      }}
                      style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '5px 8px', borderRadius: '4px', fontSize: '12px', width: '100%', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="MARKET">Market</option>
                      <option value="LIMIT">Limit</option>
                    </select>
                    {item.orderType === 'LIMIT' && (
                      <input 
                        type="number" 
                        step="0.05"
                        placeholder="Limit Price"
                        value={item.price} 
                        onChange={(e) => updateBasketItem(index, { price: e.target.value })}
                        style={{ background: 'var(--bg-dark)', border: '1px solid var(--color-blue)', color: '#fff', padding: '5px 8px', borderRadius: '4px', fontSize: '12px', width: '100%', outline: 'none' }}
                      />
                    )}
                  </div>

                  {/* Live LTP */}
                  <div style={{ textAlign: 'right', width: '75px', flexShrink: 0 }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '3px' }}>LTP</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>₹{item.livePrice.toFixed(2)}</div>
                  </div>

                  {/* Remove Button */}
                  <button onClick={() => removeFromBasket(index)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px', borderRadius: '4px', flexShrink: 0 }} title="Remove item">
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


