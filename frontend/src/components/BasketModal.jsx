import React, { useState, useEffect, useRef } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { X, Trash2, ShoppingBag, Search, Calendar } from 'lucide-react';
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

function parseOptionSymbol(symbol) {
  if (!symbol) return null;
  const clean = symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
  
  // Format 1: Monthly (e.g., NIFTY26SEP24000CE or RELIANCE26SEP680PE)
  const monthlyMatch = clean.match(/^([A-Z]+)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d+)(CE|PE)$/i);
  if (monthlyMatch) {
    return {
      underlying: monthlyMatch[1],
      isWeekly: false,
      year: '20' + monthlyMatch[2],
      month: monthlyMatch[3].toUpperCase(),
      strike: parseFloat(monthlyMatch[4]),
      optionType: monthlyMatch[5].toUpperCase()
    };
  }

  // Format 2: Weekly (e.g., NIFTY2690824000CE or SENSEX2690369100CE)
  const weeklyMatch = clean.match(/^([A-Z]+)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/i);
  if (weeklyMatch) {
    const mChar = weeklyMatch[3].toUpperCase();
    const mNum = mChar === 'O' ? 10 : (mChar === 'N' ? 11 : (mChar === 'D' ? 12 : parseInt(mChar, 10)));
    return {
      underlying: weeklyMatch[1],
      isWeekly: true,
      year: '20' + weeklyMatch[2],
      monthNum: mNum,
      day: weeklyMatch[4],
      strike: parseFloat(weeklyMatch[5]),
      optionType: weeklyMatch[6].toUpperCase()
    };
  }

  // Format 3: General fallback
  const genMatch = clean.match(/^([A-Z]+).*?(\d+)(CE|PE)$/i);
  if (genMatch) {
    return {
      underlying: genMatch[1],
      strike: parseFloat(genMatch[2]),
      optionType: genMatch[3].toUpperCase()
    };
  }

  return null;
}

function formatExpiryDisplay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const yr = String(d.getFullYear()).slice(-2);
  return `${day} ${month} ${yr}`;
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
  
  // Strategy & Underlying selection
  const [selectedUnderlying, setSelectedUnderlying] = useState('NIFTY');
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [availableExpiries, setAvailableExpiries] = useState([]);
  const [loadingChain, setLoadingChain] = useState(false);
  const [globalMultiplier, setGlobalMultiplier] = useState(1);

  const chainsCacheRef = useRef({});

  const handleGlobalMultiplierChange = (newMultiplier) => {
    const val = Math.max(1, isNaN(newMultiplier) ? 1 : newMultiplier);
    setGlobalMultiplier(val);
    if (basketItems.length > 0) {
      const updated = basketItems.map(item => ({
        ...item,
        quantity: val
      }));
      useStore.setState({ basketItems: updated });
    }
  };

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

  // Fetch Option Chain & Set Nearest Expiry by Default whenever selectedUnderlying changes
  useEffect(() => {
    if (!basketModalOpen) return;
    
    let isCancelled = false;
    const fetchChain = async () => {
      setLoadingChain(true);
      try {
        let chain = chainsCacheRef.current[selectedUnderlying];
        if (!chain) {
          const res = await fetch(`${API}/api/options/chain/${selectedUnderlying}`);
          if (res.ok) {
            chain = await res.json();
            chainsCacheRef.current[selectedUnderlying] = chain;
          }
        }

        if (!isCancelled && chain) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const expList = Object.keys(chain)
            .filter(exp => new Date(exp) >= today)
            .sort((a, b) => new Date(a) - new Date(b));

          setAvailableExpiries(expList);
          
          // Automatically select the nearest expiry
          if (expList.length > 0) {
            setSelectedExpiry(prev => (expList.includes(prev) ? prev : expList[0]));
          } else {
            setSelectedExpiry('');
          }
        }
      } catch (e) {
        console.error('Failed to fetch chain for BasketModal:', e);
      } finally {
        if (!isCancelled) setLoadingChain(false);
      }
    };

    fetchChain();
    return () => { isCancelled = true; };
  }, [basketModalOpen, selectedUnderlying]);

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

  // Enhance basket items with live price, lotsize, strike, type, and underlying/expiry info
  const enhancedItems = basketItems.map(item => {
    const symbol = item.symbol;
    const livePrice = symbol ? (prices[symbol]?.ltp || 0) : 0;
    const cleanSym = symbol ? (symbol.includes(':') ? symbol.split(':')[1] : symbol) : '';
    const isOption = /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(cleanSym);
    const parsed = isOption ? parseOptionSymbol(symbol) : null;
    const optionStrike = parsed?.strike || (isOption ? extractOptionStrike(symbol) : 0);
    const typeStr = item.optionType || parsed?.optionType || (isOption ? (/(?:\d+|[-_\s])CE/i.test(cleanSym) || cleanSym.endsWith('CE') ? 'CE' : 'PE') : 'OTHER');
    const effectiveLotsize = (item.lotsize && Number(item.lotsize) > 1) ? Number(item.lotsize) : (getInstantLotsize(symbol) || 1);
    const totalQuantity = (Number(item.quantity) || 1) * effectiveLotsize;
    
    // Resolve underlying
    const underlying = item.underlying || parsed?.underlying || selectedUnderlying;
    
    // Resolve expiry from cache if not directly present
    let expiry = item.expiry;
    if (!expiry && chainsCacheRef.current[underlying]) {
      const chain = chainsCacheRef.current[underlying];
      for (const exp of Object.keys(chain)) {
        for (const st of Object.keys(chain[exp])) {
          if (chain[exp][st]?.CE?.symbol === symbol || chain[exp][st]?.PE?.symbol === symbol) {
            expiry = exp;
            break;
          }
        }
        if (expiry) break;
      }
    }
    if (!expiry && selectedUnderlying === underlying) {
      expiry = selectedExpiry;
    }

    return {
      ...item,
      underlying,
      expiry,
      strike: item.strike || optionStrike,
      optionStrike,
      optionType: typeStr,
      lotsize: effectiveLotsize,
      livePrice,
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

  // Apply Strategy Preset using exact selected Expiry from real Option Chain
  const applyPreset = (type, customUnderlying = null) => {
    const targetUnderlying = customUnderlying || selectedUnderlying;
    const chain = chainsCacheRef.current[targetUnderlying];
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const expList = chain 
      ? Object.keys(chain).filter(exp => new Date(exp) >= today).sort((a,b) => new Date(a) - new Date(b))
      : [];
    
    const activeExpiry = (selectedExpiry && expList.includes(selectedExpiry)) 
      ? selectedExpiry 
      : (expList[0] || selectedExpiry);

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
    else if (!isMCX) indexKey = `${exch}:${targetUnderlying}-EQ`;

    const liveSpot = indexKey && prices[indexKey] ? prices[indexKey].ltp : 0;
    const fallbackSpots = {
      'NIFTY': 24500, 'BANKNIFTY': 51000, 'FINNIFTY': 23000, 'SENSEX': 80000, 'MIDCPNIFTY': 12500,
      'BANKEX': 57000, 'CRUDEOIL': 6500, 'NATURALGAS': 220, 'GOLD': 72000, 'SILVER': 85000,
      'COPPER': 800, 'ZINC': 270, 'ALUMINIUM': 230, 'RELIANCE': 1450, 'TCS': 2300, 'HDFCBANK': 710,
      'INFY': 1850, 'SBIN': 820, 'ICICIBANK': 1250, 'TATAMOTORS': 980
    };

    const spotPrice = liveSpot > 0 ? liveSpot : (fallbackSpots[targetUnderlying] || 1000);
    const lotsize = getInstantLotsize(targetUnderlying) || 1;

    let newItems = [];

    // If chain data exists for activeExpiry, pick exact contracts from the chain
    if (chain && activeExpiry && chain[activeExpiry]) {
      const strikesObj = chain[activeExpiry];
      const strikeNums = Object.keys(strikesObj).map(Number).sort((a,b) => a - b);
      
      let atmIndex = 0;
      let minDiff = Infinity;
      strikeNums.forEach((stk, idx) => {
        const diff = Math.abs(stk - spotPrice);
        if (diff < minDiff) {
          minDiff = diff;
          atmIndex = idx;
        }
      });

      const getContract = (idx, optType) => {
        const clampedIdx = Math.max(0, Math.min(strikeNums.length - 1, idx));
        const stk = strikeNums[clampedIdx];
        const data = strikesObj[stk]?.[optType];
        if (data) {
          return {
            symbol: data.symbol,
            lotsize: data.lotsize || lotsize,
            strike: stk,
            optionType: optType,
            expiry: activeExpiry,
            underlying: targetUnderlying
          };
        }
        return null;
      };

      if (type === 'BULL_CALL_SPREAD') {
        const leg1 = getContract(atmIndex, 'CE');
        const leg2 = getContract(atmIndex + 2, 'CE');
        if (leg1) newItems.push({ ...leg1, side: 'BUY', quantity: globalMultiplier, orderType: 'MARKET', price: '' });
        if (leg2) newItems.push({ ...leg2, side: 'SELL', quantity: globalMultiplier, orderType: 'MARKET', price: '' });
      } else if (type === 'BEAR_PUT_SPREAD') {
        const leg1 = getContract(atmIndex, 'PE');
        const leg2 = getContract(atmIndex - 2, 'PE');
        if (leg1) newItems.push({ ...leg1, side: 'BUY', quantity: globalMultiplier, orderType: 'MARKET', price: '' });
        if (leg2) newItems.push({ ...leg2, side: 'SELL', quantity: globalMultiplier, orderType: 'MARKET', price: '' });
      } else if (type === 'STRADDLE') {
        const leg1 = getContract(atmIndex, 'CE');
        const leg2 = getContract(atmIndex, 'PE');
        if (leg1) newItems.push({ ...leg1, side: 'SELL', quantity: globalMultiplier, orderType: 'MARKET', price: '' });
        if (leg2) newItems.push({ ...leg2, side: 'SELL', quantity: globalMultiplier, orderType: 'MARKET', price: '' });
      } else if (type === 'STRANGLE') {
        const leg1 = getContract(atmIndex + 3, 'CE');
        const leg2 = getContract(atmIndex - 3, 'PE');
        if (leg1) newItems.push({ ...leg1, side: 'SELL', quantity: globalMultiplier, orderType: 'MARKET', price: '' });
        if (leg2) newItems.push({ ...leg2, side: 'SELL', quantity: globalMultiplier, orderType: 'MARKET', price: '' });
      } else if (type === 'IRON_CONDOR') {
        const leg1 = getContract(atmIndex + 4, 'CE');
        const leg2 = getContract(atmIndex + 2, 'CE');
        const leg3 = getContract(atmIndex - 2, 'PE');
        const leg4 = getContract(atmIndex - 4, 'PE');
        if (leg1) newItems.push({ ...leg1, side: 'BUY', quantity: globalMultiplier, orderType: 'MARKET', price: '' });
        if (leg2) newItems.push({ ...leg2, side: 'SELL', quantity: globalMultiplier, orderType: 'MARKET', price: '' });
        if (leg3) newItems.push({ ...leg3, side: 'SELL', quantity: globalMultiplier, orderType: 'MARKET', price: '' });
        if (leg4) newItems.push({ ...leg4, side: 'BUY', quantity: globalMultiplier, orderType: 'MARKET', price: '' });
      }
    }

    // Fallback if chain data not loaded yet
    if (newItems.length === 0) {
      let step = 50;
      if (targetUnderlying === 'BANKNIFTY' || targetUnderlying === 'SENSEX' || targetUnderlying === 'BANKEX') step = 100;
      else if (targetUnderlying === 'MIDCPNIFTY') step = 25;
      else if (targetUnderlying === 'NATURALGAS') step = 5;
      else if (targetUnderlying === 'GOLD') step = 100;
      else if (targetUnderlying === 'SILVER') step = 250;
      else if (targetUnderlying === 'COPPER' || targetUnderlying === 'ZINC' || targetUnderlying === 'ALUMINIUM') step = 5;
      
      const roundedStrike = Math.round(spotPrice / step) * step;
      const now = new Date();
      const yr = String(now.getFullYear()).slice(-2);
      const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      const mo = months[now.getMonth()];
      const symPrefix = `${exch}:${targetUnderlying}${yr}${mo}`;

      if (type === 'BULL_CALL_SPREAD') {
        newItems = [
          { symbol: `${symPrefix}${roundedStrike}CE`, side: 'BUY', quantity: globalMultiplier, lotsize, orderType: 'MARKET', price: '', strike: roundedStrike, optionType: 'CE', underlying: targetUnderlying },
          { symbol: `${symPrefix}${roundedStrike + (step * 2)}CE`, side: 'SELL', quantity: globalMultiplier, lotsize, orderType: 'MARKET', price: '', strike: roundedStrike + (step * 2), optionType: 'CE', underlying: targetUnderlying }
        ];
      } else if (type === 'BEAR_PUT_SPREAD') {
        newItems = [
          { symbol: `${symPrefix}${roundedStrike}PE`, side: 'BUY', quantity: globalMultiplier, lotsize, orderType: 'MARKET', price: '', strike: roundedStrike, optionType: 'PE', underlying: targetUnderlying },
          { symbol: `${symPrefix}${roundedStrike - (step * 2)}PE`, side: 'SELL', quantity: globalMultiplier, lotsize, orderType: 'MARKET', price: '', strike: roundedStrike - (step * 2), optionType: 'PE', underlying: targetUnderlying }
        ];
      } else if (type === 'STRADDLE') {
        newItems = [
          { symbol: `${symPrefix}${roundedStrike}CE`, side: 'SELL', quantity: globalMultiplier, lotsize, orderType: 'MARKET', price: '', strike: roundedStrike, optionType: 'CE', underlying: targetUnderlying },
          { symbol: `${symPrefix}${roundedStrike}PE`, side: 'SELL', quantity: globalMultiplier, lotsize, orderType: 'MARKET', price: '', strike: roundedStrike, optionType: 'PE', underlying: targetUnderlying }
        ];
      } else if (type === 'STRANGLE') {
        newItems = [
          { symbol: `${symPrefix}${roundedStrike + (step * 3)}CE`, side: 'SELL', quantity: globalMultiplier, lotsize, orderType: 'MARKET', price: '', strike: roundedStrike + (step * 3), optionType: 'CE', underlying: targetUnderlying },
          { symbol: `${symPrefix}${roundedStrike - (step * 3)}PE`, side: 'SELL', quantity: globalMultiplier, lotsize, orderType: 'MARKET', price: '', strike: roundedStrike - (step * 3), optionType: 'PE', underlying: targetUnderlying }
        ];
      } else if (type === 'IRON_CONDOR') {
        newItems = [
          { symbol: `${symPrefix}${roundedStrike + (step * 4)}CE`, side: 'BUY', quantity: globalMultiplier, lotsize, orderType: 'MARKET', price: '', strike: roundedStrike + (step * 4), optionType: 'CE', underlying: targetUnderlying },
          { symbol: `${symPrefix}${roundedStrike + (step * 2)}CE`, side: 'SELL', quantity: globalMultiplier, lotsize, orderType: 'MARKET', price: '', strike: roundedStrike + (step * 2), optionType: 'CE', underlying: targetUnderlying },
          { symbol: `${symPrefix}${roundedStrike - (step * 2)}PE`, side: 'SELL', quantity: globalMultiplier, lotsize, orderType: 'MARKET', price: '', strike: roundedStrike - (step * 2), optionType: 'PE', underlying: targetUnderlying },
          { symbol: `${symPrefix}${roundedStrike - (step * 4)}PE`, side: 'BUY', quantity: globalMultiplier, lotsize, orderType: 'MARKET', price: '', strike: roundedStrike - (step * 4), optionType: 'PE', underlying: targetUnderlying }
        ];
      }
    }

    useStore.setState({ basketItems: newItems });
    newItems.forEach(i => {
      useStore.getState().subscribeToSymbol?.(i.symbol);
    });
    if (useStore.getState().fetchBatchPrices) {
      useStore.getState().fetchBatchPrices(newItems.map(i => i.symbol));
    }
  };

  // Adjust leg strike up or down by 1 interval in the option chain
  const handleLegStrikeStep = async (index, direction) => {
    const item = enhancedItems[index];
    const underlying = item.underlying || selectedUnderlying;
    let chain = chainsCacheRef.current[underlying];
    if (!chain) {
      try {
        const res = await fetch(`${API}/api/options/chain/${underlying}`);
        if (res.ok) {
          chain = await res.json();
          chainsCacheRef.current[underlying] = chain;
        }
      } catch (e) {}
    }
    const legExpiry = item.expiry || selectedExpiry || (chain ? Object.keys(chain)[0] : null);
    if (!chain || !legExpiry || !chain[legExpiry]) return;

    const strikes = Object.keys(chain[legExpiry]).map(Number).sort((a,b) => a - b);
    const curStrike = item.optionStrike || item.strike;
    const curIdx = strikes.indexOf(Number(curStrike));
    
    let targetIdx = -1;
    if (curIdx !== -1) {
      targetIdx = direction === 'UP' ? curIdx + 1 : curIdx - 1;
    } else {
      const closest = strikes.reduce((prev, curr) => Math.abs(curr - curStrike) < Math.abs(prev - curStrike) ? curr : prev, strikes[0]);
      const closestIdx = strikes.indexOf(closest);
      targetIdx = direction === 'UP' ? closestIdx + 1 : closestIdx - 1;
    }

    if (targetIdx >= 0 && targetIdx < strikes.length) {
      const newStrike = strikes[targetIdx];
      const optType = item.typeStr === 'PE' ? 'PE' : 'CE';
      const contract = chain[legExpiry][newStrike]?.[optType];
      if (contract) {
        updateBasketItem(index, {
          symbol: contract.symbol,
          strike: newStrike,
          lotsize: contract.lotsize || item.lotsize,
          expiry: legExpiry,
          optionType: optType,
          underlying: underlying
        });
        useStore.getState().subscribeToSymbol?.(contract.symbol);
        useStore.getState().fetchBatchPrices?.([contract.symbol]);
      }
    }
  };

  // Switch leg expiry to another available expiry
  const handleLegExpiryChange = async (index, newExpiry) => {
    const item = enhancedItems[index];
    const underlying = item.underlying || selectedUnderlying;
    let chain = chainsCacheRef.current[underlying];
    if (!chain) {
      try {
        const res = await fetch(`${API}/api/options/chain/${underlying}`);
        if (res.ok) {
          chain = await res.json();
          chainsCacheRef.current[underlying] = chain;
        }
      } catch (e) {}
    }
    if (!chain || !chain[newExpiry]) return;

    const availableStrikes = Object.keys(chain[newExpiry]).map(Number).sort((a,b) => a - b);
    const curStrike = item.optionStrike || item.strike;
    let targetStrike = curStrike;
    if (!chain[newExpiry][targetStrike]) {
      targetStrike = availableStrikes.reduce((prev, curr) => Math.abs(curr - curStrike) < Math.abs(prev - curStrike) ? curr : prev, availableStrikes[0]);
    }
    const optType = item.typeStr === 'PE' ? 'PE' : 'CE';
    const contract = chain[newExpiry][targetStrike]?.[optType] || chain[newExpiry][targetStrike]?.CE || chain[newExpiry][targetStrike]?.PE;
    if (contract) {
      updateBasketItem(index, {
        symbol: contract.symbol,
        expiry: newExpiry,
        strike: targetStrike,
        optionType: optType,
        lotsize: contract.lotsize || item.lotsize,
        underlying: underlying
      });
      useStore.getState().subscribeToSymbol?.(contract.symbol);
      useStore.getState().fetchBatchPrices?.([contract.symbol]);
    }
  };

  // Switch leg option type (CE <-> PE)
  const handleLegTypeToggle = async (index) => {
    const item = enhancedItems[index];
    const underlying = item.underlying || selectedUnderlying;
    let chain = chainsCacheRef.current[underlying];
    if (!chain) {
      try {
        const res = await fetch(`${API}/api/options/chain/${underlying}`);
        if (res.ok) {
          chain = await res.json();
          chainsCacheRef.current[underlying] = chain;
        }
      } catch (e) {}
    }
    const legExpiry = item.expiry || selectedExpiry || (chain ? Object.keys(chain)[0] : null);
    const curStrike = item.optionStrike || item.strike;
    const targetType = item.typeStr === 'CE' ? 'PE' : 'CE';

    if (chain && legExpiry && chain[legExpiry]?.[curStrike]?.[targetType]) {
      const contract = chain[legExpiry][curStrike][targetType];
      updateBasketItem(index, {
        symbol: contract.symbol,
        optionType: targetType,
        lotsize: contract.lotsize || item.lotsize,
        expiry: legExpiry,
        strike: curStrike,
        underlying: underlying
      });
      useStore.getState().subscribeToSymbol?.(contract.symbol);
      useStore.getState().fetchBatchPrices?.([contract.symbol]);
    } else {
      let newSym = item.symbol;
      if (item.symbol.endsWith('CE')) newSym = item.symbol.slice(0, -2) + 'PE';
      else if (item.symbol.endsWith('PE')) newSym = item.symbol.slice(0, -2) + 'CE';
      updateBasketItem(index, {
        symbol: newSym,
        optionType: targetType
      });
      useStore.getState().subscribeToSymbol?.(newSym);
      useStore.getState().fetchBatchPrices?.([newSym]);
    }
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        width: '840px', maxWidth: '96vw', background: 'var(--bg-dark)', borderRadius: '10px', 
        border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', maxHeight: '88vh'
      }}>
        
        {/* Header */}
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
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

        {/* Expiry Selector & 1-Click Strategy Presets Bar */}
        <div style={{ 
          padding: '8px 20px', background: 'rgba(255,255,255,0.02)', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          gap: '12px', flexWrap: 'wrap' 
        }}>
          {/* Expiry Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11.5px', color: '#60a5fa', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
              <Calendar size={13} /> Expiry:
            </span>
            <select
              value={selectedExpiry}
              onChange={(e) => setSelectedExpiry(e.target.value)}
              style={{
                background: 'var(--bg-panel)',
                border: '1px solid #3b82f6',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {availableExpiries.map((exp, idx) => (
                <option key={exp} value={exp}>
                  {formatExpiryDisplay(exp)} {idx === 0 ? '(Nearest)' : ''}
                </option>
              ))}
            </select>
            {loadingChain && (
              <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Loading expiries...</span>
            )}
          </div>

          {/* 1-Click Strategy Presets */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', overflowX: 'auto' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', whiteSpace: 'nowrap' }}>PRESETS:</span>
            <button type="button" onClick={() => applyPreset('BULL_CALL_SPREAD')} style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>🐂 Bull Call</button>
            <button type="button" onClick={() => applyPreset('BEAR_PUT_SPREAD')} style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>🐻 Bear Put</button>
            <button type="button" onClick={() => applyPreset('STRADDLE')} style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--color-blue-light)', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>⚡ Straddle</button>
            <button type="button" onClick={() => applyPreset('STRANGLE')} style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>🎯 Strangle</button>
            <button type="button" onClick={() => applyPreset('IRON_CONDOR')} style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>🦅 Iron Condor</button>
          </div>
        </div>

        {/* Product Type & Global Basket Multiplier Selection */}
        <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Product Type (INT / DEL) */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>Product:</span>
              <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div onClick={() => setProductType('INT')} style={{ width: '48px', textAlign: 'center', padding: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', background: productType === 'INT' ? 'rgba(34, 197, 94, 0.15)' : 'transparent', color: productType === 'INT' ? 'var(--color-green-light)' : 'var(--text-primary)' }}>INT</div>
                <div onClick={() => setProductType('DEL')} style={{ width: '48px', textAlign: 'center', padding: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', background: productType === 'DEL' ? 'rgba(34, 197, 94, 0.15)' : 'transparent', color: productType === 'DEL' ? 'var(--color-green-light)' : 'var(--text-primary)' }}>DEL</div>
              </div>
            </div>

            {/* Global All Legs Multiplier */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: '#60a5fa', fontWeight: '700' }}>Basket Lots:</span>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-panel)', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => handleGlobalMultiplierChange(Math.max(1, globalMultiplier - 1))}
                  style={{ width: '24px', height: '24px', background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Decrease all lots"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={globalMultiplier}
                  onChange={e => handleGlobalMultiplierChange(parseInt(e.target.value, 10) || 1)}
                  style={{ width: '34px', height: '24px', textAlign: 'center', background: 'var(--bg-dark)', border: 'none', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', color: '#60a5fa', fontSize: '11.5px', fontWeight: '800', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => handleGlobalMultiplierChange(globalMultiplier + 1)}
                  style={{ width: '24px', height: '24px', background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Increase all lots"
                >
                  +
                </button>
              </div>

              {/* Quick Multiplier Buttons */}
              <div style={{ display: 'flex', gap: '3px' }}>
                {[1, 2, 3, 5, 10].map(m => {
                  const isAct = globalMultiplier === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleGlobalMultiplierChange(m)}
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isAct ? 'var(--color-blue)' : 'rgba(255,255,255,0.06)',
                        border: isAct ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                        color: isAct ? '#fff' : 'var(--text-secondary)',
                        fontSize: '10px',
                        fontWeight: isAct ? '800' : '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {m}x
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {hedgedMargin > 0 && (
            <div style={{ fontSize: '10.5px', color: '#4ade80', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', padding: '3px 8px', borderRadius: '12px', fontWeight: '700' }}>
              🛡️ Hedge Benefit Applied
            </div>
          )}
        </div>

        {/* Search & Add Any Stock/Option to Basket */}
        <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '5px 10px' }}>
            <Search size={13} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="Search & add any stock, futures, or option to basket (e.g. RELIANCE, NIFTY, TCS)..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '12px', outline: 'none', flex: 1 }}
            />
            {searchQuery && (
              <X size={13} color="var(--text-secondary)" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
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

        {/* Item List / Strategy Legs Table */}
        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
          {basketItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0', fontSize: '13px' }}>
              Your basket is empty. Select a strategy preset above or search any contract to add.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {enhancedItems.map((item, index) => {
                const legUnderlying = item.underlying || selectedUnderlying;
                const legChain = chainsCacheRef.current[legUnderlying];
                const today = new Date();
                today.setHours(0,0,0,0);
                const legExpiries = legChain 
                  ? Object.keys(legChain).filter(e => new Date(e) >= today).sort((a,b) => new Date(a) - new Date(b))
                  : (availableExpiries.length > 0 ? availableExpiries : [item.expiry].filter(Boolean));

                return (
                  <div key={index} style={{
                    display: 'flex', alignItems: 'center', padding: '10px 14px',
                    background: 'var(--bg-panel)', borderRadius: '6px',
                    border: '1px solid var(--border-color)', gap: '10px',
                    flexWrap: 'wrap'
                  }}>
                    {/* B/S Pill Button */}
                    <button
                      type="button"
                      onClick={() => updateBasketItem(index, { side: item.side === 'BUY' ? 'SELL' : 'BUY' })}
                      style={{
                        width: '32px', height: '32px', borderRadius: '4px',
                        background: item.side === 'BUY' ? '#16a34a' : '#dc2626',
                        color: '#fff', border: 'none', fontSize: '13px', fontWeight: '900',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, boxShadow: item.side === 'BUY' ? '0 0 10px rgba(22,163,74,0.3)' : '0 0 10px rgba(220,38,38,0.3)'
                      }}
                      title="Toggle BUY / SELL"
                    >
                      {item.side === 'BUY' ? 'B' : 'S'}
                    </button>

                    {/* Option Leg Controls: Expiry | Strike | Type */}
                    {item.isOption ? (
                      <>
                        {/* Expiry Selector */}
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '95px' }}>
                          <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '2px' }}>EXPIRY</span>
                          <select
                            value={item.expiry || selectedExpiry}
                            onChange={(e) => handleLegExpiryChange(index, e.target.value)}
                            style={{
                              background: 'var(--bg-dark)', border: '1px solid var(--border-color)',
                              color: '#60a5fa', padding: '4px 6px', borderRadius: '4px',
                              fontSize: '11px', fontWeight: '700', outline: 'none', cursor: 'pointer'
                            }}
                          >
                            {legExpiries.map(exp => (
                              <option key={exp} value={exp}>
                                {formatExpiryDisplay(exp)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Strike Stepper */}
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '105px' }}>
                          <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '2px' }}>STRIKE</span>
                          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-dark)', overflow: 'hidden' }}>
                            <button
                              type="button"
                              onClick={() => handleLegStrikeStep(index, 'DOWN')}
                              style={{ width: '24px', height: '26px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                              title="Lower strike"
                            >
                              -
                            </button>
                            <span style={{ flex: 1, textAlign: 'center', fontSize: '11.5px', fontWeight: '800', color: '#fff' }}>
                              {item.optionStrike || item.strike || '-'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleLegStrikeStep(index, 'UP')}
                              style={{ width: '24px', height: '26px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                              title="Higher strike"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Option Type (CE / PE) Toggle */}
                        <div style={{ display: 'flex', flexDirection: 'column', width: '50px' }}>
                          <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '2px' }}>TYPE</span>
                          <button
                            type="button"
                            onClick={() => handleLegTypeToggle(index)}
                            style={{
                              height: '26px', borderRadius: '4px',
                              background: item.typeStr === 'CE' ? 'rgba(59,130,246,0.15)' : 'rgba(234,179,8,0.15)',
                              border: item.typeStr === 'CE' ? '1px solid #3b82f6' : '1px solid #eab308',
                              color: item.typeStr === 'CE' ? '#60a5fa' : '#facc15',
                              fontSize: '11px', fontWeight: '800', cursor: 'pointer'
                            }}
                            title="Click to toggle CE / PE"
                          >
                            {item.typeStr}
                          </button>
                        </div>
                      </>
                    ) : (
                      /* Non-option Symbol Display */
                      <div style={{ flex: 1, minWidth: '160px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{item.symbol}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Lot: {item.lotsize || 1}</div>
                      </div>
                    )}

                    {/* Lots Stepper */}
                    <div style={{ display: 'flex', flexDirection: 'column', width: '85px' }}>
                      <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '2px' }}>
                        LOT (×{item.lotsize || 1})
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-dark)', overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() => updateBasketItem(index, { quantity: Math.max(1, (item.quantity || 1) - 1) })}
                          style={{ width: '22px', height: '26px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity || 1}
                          onChange={(e) => updateBasketItem(index, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                          style={{ width: '36px', height: '26px', background: 'transparent', border: 'none', color: '#fff', fontSize: '11.5px', fontWeight: '700', textAlign: 'center', outline: 'none' }}
                        />
                        <button
                          type="button"
                          onClick={() => updateBasketItem(index, { quantity: (item.quantity || 1) + 1 })}
                          style={{ width: '22px', height: '26px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Order Type & Limit Price */}
                    <div style={{ display: 'flex', flexDirection: 'column', width: '115px' }}>
                      <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '2px' }}>ORDER</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <select
                          value={item.orderType}
                          onChange={(e) => {
                            const newType = e.target.value;
                            const defaultPrice = item.price || (item.livePrice > 0 ? item.livePrice.toFixed(2) : '');
                            updateBasketItem(index, {
                              orderType: newType,
                              price: newType === 'LIMIT' ? defaultPrice : ''
                            });
                          }}
                          style={{
                            flex: item.orderType === 'LIMIT' ? '0 0 50px' : 1,
                            height: '26px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)',
                            color: '#fff', padding: '2px 4px', borderRadius: '4px', fontSize: '11px', outline: 'none', cursor: 'pointer'
                          }}
                        >
                          <option value="MARKET">Mkt</option>
                          <option value="LIMIT">Lmt</option>
                        </select>
                        {item.orderType === 'LIMIT' && (
                          <input
                            type="number"
                            step="0.05"
                            placeholder="Price"
                            value={item.price}
                            onChange={(e) => updateBasketItem(index, { price: e.target.value })}
                            style={{
                              flex: 1, minWidth: 0, height: '26px', background: 'var(--bg-dark)',
                              border: '1px solid var(--color-blue)', color: '#fff', padding: '2px 4px',
                              borderRadius: '4px', fontSize: '11px', outline: 'none'
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {/* LTP */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '70px', marginLeft: 'auto' }}>
                      <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '2px' }}>LTP</span>
                      <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#fff' }}>
                        ₹{item.livePrice > 0 ? item.livePrice.toFixed(2) : '-'}
                      </span>
                    </div>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => removeFromBasket(index)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Remove leg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '14px 20px', borderTop: '1px solid var(--border-color)' }}>
          {isInsufficient && basketItems.length > 0 && (
            <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '8px 12px', borderRadius: '4px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: 'var(--color-yellow)', color: '#000', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px' }}>!</div>
              <div style={{ fontSize: '12px', color: '#fef08a' }}>Insufficient margin! Shortfall: ₹{(finalMargin - balanceNum).toFixed(2)}</div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Available Balance</div>
                <div style={{ fontSize: '13.5px', fontWeight: '700' }}>₹{balanceNum.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '10.5px', color: 'var(--color-blue)', marginBottom: '2px' }}>Combined Margin</div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--color-blue)' }}>₹{finalMargin.toFixed(2)}</div>
              </div>
            </div>
            <button 
              onClick={handleExecute}
              disabled={isInsufficient || isSubmitting || basketItems.length === 0}
              style={{ 
                background: (isInsufficient || basketItems.length === 0) ? 'var(--bg-panel)' : 'var(--color-blue)', 
                color: (isInsufficient || basketItems.length === 0) ? 'var(--text-secondary)' : '#fff', 
                padding: '10px 22px', borderRadius: '6px', fontSize: '13px', fontWeight: '800', letterSpacing: '0.5px',
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


