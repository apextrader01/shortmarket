import { useShallow } from 'zustand/react/shallow';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore, API } from '../store';
import { getInstantLotsize } from '../utils/lotsizeHelper';
import OptionsStrategyBuilder from './OptionsStrategyBuilder';
import OptionChainRow from './OptionChainRow';
import { Clock, ChevronLeft } from 'lucide-react';

// Custom Searchable Dropdown
const SymbolDropdown = ({ value, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="custom-dropdown" ref={dropdownRef}>
      <div className="custom-dropdown-header" onClick={() => { setIsOpen(!isOpen); setSearch(''); }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fi fi-rr-search" style={{ color: '#94a3b8' }}></i>
          <span>{value}</span>
        </div>
        <i className="fi fi-rr-angle-small-down" style={{ fontSize: '12px' }}></i>
      </div>
      {isOpen && (
        <div className="custom-dropdown-list-container">
          <input 
            type="text" 
            placeholder="Search symbols..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="custom-dropdown-search"
          />
          <div className="custom-dropdown-list">
            {filteredOptions.length > 0 ? filteredOptions.map(opt => (
              <div 
                key={opt} 
                className="custom-dropdown-item"
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
              >
                {opt}
              </div>
            )) : <div className="custom-dropdown-item text-muted">No results found</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const ALLOWED_INDEX_SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 'BANKEX'];

const formatOI = (oi) => {
  if (!oi || isNaN(Number(oi)) || Number(oi) === 0) return '0';
  const n = Number(oi);
  if (n >= 10000000) return (n / 10000000).toFixed(2) + 'Cr';
  if (n >= 100000) return (n / 100000).toFixed(2) + 'L';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString('en-IN');
};

const PcrSummary = React.memo(({ strikes, chain }) => {
  const pcrStats = useStore(useShallow(state => {
    let callOi = 0;
    let putOi = 0;
    const prices = state.prices;
    for (const s of (strikes || [])) {
      const c = chain[s]?.CE;
      const p = chain[s]?.PE;
      if (c) {
        const cRaw = c.symbol ? c.symbol.replace(/^[A-Z]+:/, '') : null;
        const cKey = c.symbol ? (c.symbol.includes('-') ? c.symbol : `${c.symbol}-${c.exch_seg}`) : null;
        const cPref = c.symbol && !c.symbol.includes(':') ? `${c.exch_seg || 'NSE'}:${c.symbol}` : c.symbol;
        const cData = prices[c.symbol] || (cRaw ? prices[cRaw] : null) || (cPref ? prices[cPref] : null) || (cKey ? prices[cKey] : null);
        const cVal = Number(cData?.oi ?? c.oi ?? 0);
        if (cVal > 0) callOi += cVal;
      }
      if (p) {
        const pRaw = p.symbol ? p.symbol.replace(/^[A-Z]+:/, '') : null;
        const pKey = p.symbol ? (p.symbol.includes('-') ? p.symbol : `${p.symbol}-${p.exch_seg}`) : null;
        const pPref = p.symbol && !p.symbol.includes(':') ? `${p.exch_seg || 'NSE'}:${p.symbol}` : p.symbol;
        const pData = prices[p.symbol] || (pRaw ? prices[pRaw] : null) || (pPref ? prices[pPref] : null) || (pKey ? prices[pKey] : null);
        const pVal = Number(pData?.oi ?? p.oi ?? 0);
        if (pVal > 0) putOi += pVal;
      }
    }
    const pcr = callOi > 0 ? (putOi / callOi).toFixed(2) : (putOi > 0 ? '∞' : '1.00');
    return { callOi, putOi, pcr };
  }));

  return (
    <div className="top-bar-section">
      <span className="top-bar-label">PCR (OI)</span>
      <span className="top-bar-value" style={{ fontWeight: '700', color: Number(pcrStats.pcr) >= 1 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
        {pcrStats.pcr}
      </span>
      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: '4px' }}>
        ({formatOI(pcrStats.putOi)}P / {formatOI(pcrStats.callOi)}C)
      </span>
    </div>
  );
});

const COMMODITIES = [
  'CRUDEOIL', 'CRUDEOILM', 
  'GOLD', 'GOLDM', 'GOLDGUINEA', 'GOLDPETAL', 
  'SILVER', 'SILVERM', 'SILVERMIC', 
  'NATURALGAS', 'NATURALGASM', 
  'COPPER', 'ZINC', 'ZINCMINI', 'LEAD', 'LEADMINI', 'ALUMINIUM', 'ALUMINI', 'MENTHAOIL', 'COTTONCNDY'
];

const getIndexCandidates = (sym) => {
  switch (sym) {
    case 'NIFTY': return ['NSE:NIFTY50-INDEX', 'NIFTY50-INDEX', 'NIFTY-NSE', 'NIFTY 50', 'NIFTY'];
    case 'BANKNIFTY': return ['NSE:NIFTYBANK-INDEX', 'NIFTYBANK-INDEX', 'BANKNIFTY-NSE', 'NIFTY BANK', 'BANKNIFTY'];
    case 'FINNIFTY': return ['NSE:FINNIFTY-INDEX', 'FINNIFTY-INDEX', 'FINNIFTY-NSE', 'NIFTY FIN SERVICE', 'FINNIFTY'];
    case 'SENSEX': return ['BSE:SENSEX-INDEX', 'SENSEX-INDEX', 'SENSEX-BSE', 'SENSEX'];
    case 'BANKEX': return ['BSE:BANKEX-INDEX', 'BANKEX-INDEX', 'BANKEX-BSE', 'BANKEX'];
    default: return [`NSE:${sym}-INDEX`, `${sym}-NSE`];
  }
};

const getIndexKey = (sym) => {
  switch (sym) {
    case 'NIFTY': return 'NSE:NIFTY50-INDEX';
    case 'BANKNIFTY': return 'NSE:NIFTYBANK-INDEX';
    case 'FINNIFTY': return 'NSE:FINNIFTY-INDEX';
    case 'SENSEX': return 'BSE:SENSEX-INDEX';
    case 'BANKEX': return 'BSE:BANKEX-INDEX';
    default: return `NSE:${sym}-INDEX`;
  }
};

const OptionChainViewInternal = () => {
  const [symbol, setSymbol] = useState('NIFTY');
  const [availableSymbols, setAvailableSymbols] = useState(ALLOWED_INDEX_SYMBOLS);
  const [expiry, setExpiry] = useState('');
  const [expiries, setExpiries] = useState([]);
  const [optionsData, setOptionsData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [futureData, setFutureData] = useState(null);
  const [futureTokenKey, setFutureTokenKey] = useState(null);
  const [initialSpotPrice, setInitialSpotPrice] = useState(null);

  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const res = await fetch(`${API}/api/options/symbols`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const matched = ALLOWED_INDEX_SYMBOLS.filter(s => data.includes(s));
            setAvailableSymbols(matched.length > 0 ? matched : ALLOWED_INDEX_SYMBOLS);
            return;
          }
        }
      } catch (err) {
        console.warn('Using default 5 major index symbols for option chain', err);
      }
      setAvailableSymbols(ALLOWED_INDEX_SYMBOLS);
    };
    fetchSymbols();
  }, []);

  const openOrderModal = useStore((state) => state.openOrderModal);
  const subscribeToOptionBatch = useStore((state) => state.subscribeToOptionBatch);
  const unsubscribeFromOptionBatch = useStore((state) => state.unsubscribeFromOptionBatch);
  const subscribeToSymbol = useStore((state) => state.subscribeToSymbol);
  const unsubscribeFromSymbol = useStore((state) => state.unsubscribeFromSymbol);
  
  const basketMode = useStore((state) => state.basketMode);
  const setBasketMode = useStore((state) => state.setBasketMode);
  const addToBasket = useStore((state) => state.addToBasket);
  const { basketItems, setBasketModalOpen, oneClickMode, oneClickMultiplier, placeOrder } = useStore(useShallow(state => ({ basketItems: state.basketItems, setBasketModalOpen: state.setBasketModalOpen, oneClickMode: state.oneClickMode, oneClickMultiplier: state.oneClickMultiplier, placeOrder: state.placeOrder })));
  const setChartModalSymbol = useStore((state) => state.setChartModalSymbol);
  const setAlertModalSymbol = useStore((state) => state.setAlertModalSymbol);
  const openMarketDepthModal = useStore((state) => state.openMarketDepthModal);
  const openDomLadderModal = useStore((state) => state.openDomLadderModal);

  const atmRowRef = useRef(null);
  const hasScrolledRef = useRef(false);
  const [strategyMode, setStrategyMode] = useState(false);
  const [strategyLegs, setStrategyLegs] = useState([]);
  const [strategyModalOpen, setStrategyModalOpen] = useState(false);

  const indexCandidates = useMemo(() => getIndexCandidates(symbol), [symbol]);
  const indexKey = useMemo(() => getIndexKey(symbol), [symbol]);
  const isCommodity = useMemo(() => COMMODITIES.includes(symbol), [symbol]);

  useEffect(() => {
    let isCancelled = false;
    const fetchChainAndFuture = async () => {
      setLoading(true);
      setError(null);
      setOptionsData({}); // Clear old chain data
      try {
        const initialToFetch = ['NSE:INDIAVIX-INDEX', 'INDIAVIX-INDEX', ...indexCandidates];

        // Fire ALL requests in parallel — don't wait for one before starting the next
        const [futRes, chainRes, _] = await Promise.all([
          fetch(`${API}/api/options/futures/${symbol}`),
          fetch(`${API}/api/options/chain/${symbol}`),
          useStore.getState().fetchBatchPrices(initialToFetch)
        ]);

        if (isCancelled) return;

        // Process futures result
        let futDataResult = null;
        if (futRes.ok) {
          futDataResult = await futRes.json();
          if (!isCancelled) {
            setFutureData(futDataResult);
            const futKey = futDataResult.symbol;
            setFutureTokenKey(futKey);
            
            // For commodities, fetch its price
            if (isCommodity) {
              await useStore.getState().fetchBatchPrices([futKey]);
            }
          }
        } else if (!isCancelled) {
          setFutureData(null);
          setFutureTokenKey(null);
        }

        // Set initialSpotPrice immediately from the store
        const storeState = useStore.getState().prices;
        let resolvedSpotPrice = null;
        for (const k of indexCandidates) {
          if (storeState[k]?.ltp > 0) {
            resolvedSpotPrice = storeState[k].ltp;
            break;
          }
        }
        if (resolvedSpotPrice === null && isCommodity && futDataResult) {
          const futKey = futDataResult.symbol;
          if (storeState[futKey]?.ltp > 0) {
            resolvedSpotPrice = storeState[futKey].ltp;
          }
        }
        if (resolvedSpotPrice !== null && !isCancelled) {
          setInitialSpotPrice(resolvedSpotPrice);
        }

        // Process chain result
        if (!chainRes.ok) {
          const errBody = await chainRes.json().catch(()=>({}));
          throw new Error(errBody.error || 'Failed to fetch option chain');
        }
        const data = await chainRes.json();
        
        if (!isCancelled) {
          setOptionsData(data);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let expList = Object.keys(data)
            .filter(exp => new Date(exp) >= today)
            .sort((a, b) => new Date(a) - new Date(b));
          if (expList.length === 0) {
            expList = Object.keys(data).sort((a, b) => new Date(a) - new Date(b));
          }
          setExpiries(expList);
          if (expList.length > 0) {
            setExpiry(expList[0]);
          }
        }

      } catch (err) {
        if (!isCancelled) {
          console.error(err);
          setError(err.message);
          setOptionsData({});
          setExpiries([]);
          setExpiry('');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };
    fetchChainAndFuture();
    hasScrolledRef.current = false; // Reset scroll on symbol change
    setInitialSpotPrice(null); // Reset spot price anchor
    setFutureData(null);
    return () => { isCancelled = true; };
  }, [symbol, isCommodity, indexCandidates]);

  // Read primitive numbers directly from store: NO inline object allocation, ZERO infinite re-renders!
  const spotPrice = useStore(useCallback(state => {
    for (const k of indexCandidates) {
      const p = state.prices[k];
      if (p?.ltp > 0) return p.ltp;
    }
    return 0;
  }, [indexCandidates]));

  const spotPct = useStore(useCallback(state => {
    for (const k of indexCandidates) {
      const p = state.prices[k];
      if (p?.ltp > 0) return p.pct || 0;
    }
    return 0;
  }, [indexCandidates]));
  
  const futPrice = useStore(useCallback(state => futureTokenKey ? (state.prices[futureTokenKey]?.ltp || 0) : 0, [futureTokenKey]));
  const futPct = useStore(useCallback(state => futureTokenKey ? (state.prices[futureTokenKey]?.pct || 0) : 0, [futureTokenKey]));

  const vixPrice = useStore(useCallback(state => {
    return state.prices['NSE:INDIAVIX-INDEX']?.ltp || 
           state.prices['INDIAVIX-INDEX']?.ltp || 
           state.prices['INDIAVIX']?.ltp || 
           state.prices['INDIA VIX-NSE']?.ltp || 0;
  }, []));

  const vixChange = useStore(useCallback(state => {
    return state.prices['NSE:INDIAVIX-INDEX']?.change || 
           state.prices['INDIAVIX-INDEX']?.change || 
           state.prices['INDIAVIX']?.change || 
           state.prices['INDIA VIX-NSE']?.change || 0;
  }, []));

  const basePrice = spotPrice > 0 ? spotPrice : (futPrice > 0 ? futPrice : null);

  const chain = optionsData[expiry] || {};
  const allStrikes = useMemo(() => Object.keys(chain).map(Number).sort((a, b) => a - b), [chain]);
  const effectiveSpotPrice = initialSpotPrice || (basePrice > 0 ? basePrice : (allStrikes.length > 0 ? allStrikes[Math.floor(allStrikes.length / 2)] : null));

  // Memoized 31-strike window (15 ITM, 1 ATM, 15 OTM = 31 total strikes)
  const strikes = useMemo(() => {
    if (!effectiveSpotPrice || allStrikes.length === 0) return [];
    const atmStrike = allStrikes.reduce((prev, curr) => 
      Math.abs(curr - effectiveSpotPrice) < Math.abs(prev - effectiveSpotPrice) ? curr : prev
    );
    const atmIndex = allStrikes.indexOf(atmStrike);
    const startIndex = Math.max(0, atmIndex - 15);
    const endIndex = Math.min(allStrikes.length - 1, atmIndex + 15);
    return allStrikes.slice(startIndex, endIndex + 1);
  }, [effectiveSpotPrice, allStrikes]);

  useEffect(() => {
    if (!expiry || !optionsData[expiry]) return;

    // Subscribe to all underlying index aliases for Spot Price and VIX
    indexCandidates.forEach(sym => subscribeToSymbol(sym));
    subscribeToSymbol('NSE:INDIAVIX-INDEX');
    subscribeToSymbol('INDIAVIX-INDEX');

    if (futureData) {
      subscribeToOptionBatch([{ token: futureData.token, exchange: futureData.exchange }]);
    }

    const tokensToSub = [];
    if (strikes.length > 0) {
      strikes.forEach((strike) => {
        const data = optionsData[expiry]?.[strike];
        if (data?.CE) tokensToSub.push({ ...data.CE, exchange: data.CE.exch_seg, name: symbol });
        if (data?.PE) tokensToSub.push({ ...data.PE, exchange: data.PE.exch_seg, name: symbol });
      });

      if (tokensToSub.length > 0) {
        subscribeToOptionBatch(tokensToSub);
        
        // Instantly fetch snapshot of the visible options so they load immediately
        const uniqueSymbolsToFetch = [...indexCandidates, 'NSE:INDIAVIX-INDEX'];
        if (futureData) uniqueSymbolsToFetch.push(futureData.symbol);

        strikes.forEach((strike) => {
          const data = optionsData[expiry]?.[strike];
          if (data?.CE) uniqueSymbolsToFetch.push({ symbol: data.CE.symbol, token: data.CE.token, exchange: data.CE.exch_seg, lotsize: data.CE.lotsize });
          if (data?.PE) uniqueSymbolsToFetch.push({ symbol: data.PE.symbol, token: data.PE.token, exchange: data.PE.exch_seg, lotsize: data.PE.lotsize });
        });

        if (uniqueSymbolsToFetch.length > 0) {
          useStore.getState().fetchBatchPrices(uniqueSymbolsToFetch);
        }
      }
    }

    hasScrolledRef.current = false; // Reset scroll on expiry change without causing re-render

    return () => {
      indexCandidates.forEach(sym => unsubscribeFromSymbol(sym));
      unsubscribeFromSymbol('NSE:INDIAVIX-INDEX');
      unsubscribeFromSymbol('INDIAVIX-INDEX');
      if (futureData) {
        unsubscribeFromOptionBatch([{ token: futureData.token, exchange: futureData.exchange }]);
      }
      if (tokensToSub.length > 0) {
        unsubscribeFromOptionBatch(tokensToSub);
      }
    };
  }, [expiry, optionsData, symbol, futureData, strikes, indexCandidates, subscribeToOptionBatch, unsubscribeFromOptionBatch, subscribeToSymbol, unsubscribeFromSymbol]);

  // Auto-scroll to ATM strike when data is available
  useEffect(() => {
    if (!hasScrolledRef.current && atmRowRef.current && (spotPrice > 0 || effectiveSpotPrice > 0)) {
      const timer = setTimeout(() => {
        if (atmRowRef.current) {
          const container = document.querySelector('.option-chain-table-container');
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const rowRect = atmRowRef.current.getBoundingClientRect();
            container.scrollBy({
              top: (rowRect.top - containerRect.top) - (containerRect.height / 2) + (rowRect.height / 2),
              behavior: 'smooth'
            });
            hasScrolledRef.current = true;
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [spotPrice, effectiveSpotPrice, strikes]);

  const handleTrade = (opt, type, optionType, iv) => {
    if (!opt) return;
    
    // Construct unique symbol
    const optKey = opt.symbol;
    
    // Add to strategy builder if in strategy mode
    if (strategyMode) {
      const currentPrices = useStore.getState().prices;
      const priceData = currentPrices[optKey] || {};
      const price = priceData.ltp || 0;
      setStrategyLegs(prev => [...prev, {
        optionType,
        strike: parseFloat(opt.strike),
        price: parseFloat(price),
        side: type === 'BUY' ? 'BUY' : 'SELL',
        quantity: 1,
        lotsize: opt.lotsize ? parseInt(opt.lotsize) : 1,
        iv: iv || 0,
        symbol: optKey
      }]);
      return;
    }
    
    if (basketMode) {
      addToBasket({
        symbol: optKey,
        side: type === 'BUY' ? 'BUY' : 'SELL',
        quantity: 1,
        lotsize: opt.lotsize ? parseInt(opt.lotsize) : 1,
        orderType: 'MARKET',
        price: ''
      });
    } else if (oneClickMode) {
      // ONE-CLICK SCALPER MODE: Bypass modal, execute instantly at Market Price
      const lotsize = opt.lotsize ? parseInt(opt.lotsize) : 1;
      const finalQuantity = lotsize * (oneClickMultiplier || 1);
      const currentPrices = useStore.getState().prices;
      const livePrice = currentPrices[optKey]?.ltp || 0;
      
      const payload = {
        symbol: optKey,
        type: 'MARKET',
        side: type === 'BUY' ? 'BUY' : 'SELL',
        quantity: finalQuantity,
        price: livePrice,
        trigger_price: null,
        sl_price: null,
        tgt_price: null,
        margin: 0, // Backend enforces balance anyway
        product_type: 'INT' // Intraday by default for scalping
      };
      
      placeOrder(payload); // Async, but we don't need to block UI
    } else {
      openOrderModal(optKey, type === 'BUY' ? 'BUY' : 'SELL', opt.lotsize ? parseInt(opt.lotsize) : 1);
    }
  };

  // Loading and error states handled in the table container to keep top bar visible
  // Time to Expiry (T in years)
  let T = 0.01; // Default to a small fraction if we can't parse
  if (expiry) {
    const expDate = new Date(expiry);
    if (!isNaN(expDate.getTime())) {
      const now = new Date();
      expDate.setHours(15, 30, 0, 0); // Indian market close
      const diffMs = expDate.getTime() - now.getTime();
      T = Math.max(diffMs / (1000 * 60 * 60 * 24 * 365), 0.0001); // Prevent zero T
    }
  }

  const r = 0.10; // 10% risk-free rate (NSE Standard for IV calculations)

  // Find ATM strike (closest to spotPrice or effectiveSpotPrice fallback)
  let atmStrike = null;
  const targetSpot = basePrice > 0 ? basePrice : effectiveSpotPrice;
  if (targetSpot > 0 && strikes.length > 0) {
    atmStrike = strikes.reduce((prev, curr) => 
      Math.abs(curr - targetSpot) < Math.abs(prev - targetSpot) ? curr : prev
    );
  }

  const applyTemplate = (templateId) => {
    if (!templateId || !optionsData || Object.keys(optionsData).length === 0 || !atmStrike) return;
    
    const atmIndex = strikes.indexOf(atmStrike);
    let newLegs = [];

    const getLeg = (strikeIdx, type, side) => {
      if (strikeIdx < 0 || strikeIdx >= strikes.length) return null;
      const strike = strikes[strikeIdx];
      const option = optionsData[expiry]?.[strike];
      if (!option) return null;
      const legData = type === 'CE' ? option.CE : option.PE;
      if (!legData) return null;
      return {
        symbol: legData.symbol,
        strike,
        optionType: type,
        side,
        quantity: 1,
        lotsize: getInstantLotsize(legData.symbol),
        price: legData.ltp || 0,
        iv: legData.iv || 0.2
      };
    };

    if (templateId === 'bull_call_spread') {
      const buyLeg = getLeg(atmIndex, 'CE', 'BUY');
      const sellLeg = getLeg(atmIndex + 1, 'CE', 'SELL');
      if (buyLeg) newLegs.push(buyLeg);
      if (sellLeg) newLegs.push(sellLeg);
    } else if (templateId === 'bear_put_spread') {
      const buyLeg = getLeg(atmIndex, 'PE', 'BUY');
      const sellLeg = getLeg(atmIndex - 1, 'PE', 'SELL');
      if (buyLeg) newLegs.push(buyLeg);
      if (sellLeg) newLegs.push(sellLeg);
    } else if (templateId === 'straddle') {
      const ceLeg = getLeg(atmIndex, 'CE', 'SELL');
      const peLeg = getLeg(atmIndex, 'PE', 'SELL');
      if (ceLeg) newLegs.push(ceLeg);
      if (peLeg) newLegs.push(peLeg);
    } else if (templateId === 'long_straddle') {
      const ceLeg = getLeg(atmIndex, 'CE', 'BUY');
      const peLeg = getLeg(atmIndex, 'PE', 'BUY');
      if (ceLeg) newLegs.push(ceLeg);
      if (peLeg) newLegs.push(peLeg);
    } else if (templateId === 'short_strangle') {
      const ceLeg = getLeg(atmIndex + 1, 'CE', 'SELL');
      const peLeg = getLeg(atmIndex - 1, 'PE', 'SELL');
      if (ceLeg) newLegs.push(ceLeg);
      if (peLeg) newLegs.push(peLeg);
    } else if (templateId === 'long_strangle') {
      const ceLeg = getLeg(atmIndex + 1, 'CE', 'BUY');
      const peLeg = getLeg(atmIndex - 1, 'PE', 'BUY');
      if (ceLeg) newLegs.push(ceLeg);
      if (peLeg) newLegs.push(peLeg);
    } else if (templateId === 'bull_put_spread') {
      const sellLeg = getLeg(atmIndex, 'PE', 'SELL');
      const buyLeg = getLeg(atmIndex - 1, 'PE', 'BUY');
      if (sellLeg) newLegs.push(sellLeg);
      if (buyLeg) newLegs.push(buyLeg);
    } else if (templateId === 'bear_call_spread') {
      const sellLeg = getLeg(atmIndex, 'CE', 'SELL');
      const buyLeg = getLeg(atmIndex + 1, 'CE', 'BUY');
      if (sellLeg) newLegs.push(sellLeg);
      if (buyLeg) newLegs.push(buyLeg);
    } else if (templateId === 'iron_butterfly') {
      const buyPe = getLeg(atmIndex - 1, 'PE', 'BUY');
      const sellPe = getLeg(atmIndex, 'PE', 'SELL');
      const sellCe = getLeg(atmIndex, 'CE', 'SELL');
      const buyCe = getLeg(atmIndex + 1, 'CE', 'BUY');
      if (buyPe) newLegs.push(buyPe);
      if (sellPe) newLegs.push(sellPe);
      if (sellCe) newLegs.push(sellCe);
      if (buyCe) newLegs.push(buyCe);
    } else if (templateId === 'iron_condor') {
      const sellPe = getLeg(atmIndex - 1, 'PE', 'SELL');
      const buyPe = getLeg(atmIndex - 2, 'PE', 'BUY');
      const sellCe = getLeg(atmIndex + 1, 'CE', 'SELL');
      const buyCe = getLeg(atmIndex + 2, 'CE', 'BUY');
      if (sellPe) newLegs.push(sellPe);
      if (buyPe) newLegs.push(buyPe);
      if (sellCe) newLegs.push(sellCe);
      if (buyCe) newLegs.push(buyCe);
    }

    if (newLegs.length > 0) {
      setStrategyLegs(newLegs);
      if (!strategyModalOpen) setStrategyModalOpen(true);
    }
  };

  return (
    <div className="option-chain-container glass-panel">
      {/* Header */}
      <div className="option-chain-top-bar">
        {/* Section 1: Major Index Switcher & Spot Price */}
        <div className="top-bar-section" style={{ gap: '10px' }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: 'rgba(255, 255, 255, 0.04)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {ALLOWED_INDEX_SYMBOLS.map((idxSym) => {
              const isSelected = symbol === idxSym;
              return (
                <button
                  key={idxSym}
                  onClick={() => setSymbol(idxSym)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: isSelected ? '800' : '600',
                    border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                    background: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                    color: isSelected ? '#60a5fa' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    letterSpacing: '0.3px'
                  }}
                >
                  {idxSym}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginLeft: '4px' }}>
            <span className="top-bar-price" style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
              {spotPrice > 0 ? spotPrice.toFixed(2) : '-'}
            </span>
            <span className={`top-bar-pct ${spotPct >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '11.5px', fontWeight: '700' }}>
              {spotPct > 0 ? '+' : ''}{spotPct.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="top-bar-divider"></div>

        {/* Section 2: Expiry */}
        <div className="top-bar-section">
          <span className="top-bar-label">Expiry</span>
          <select 
            className="expiry-select-minimal"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          >
            {expiries.map(exp => (
              <option key={exp} value={exp}>{exp}</option>
            ))}
          </select>
        </div>

        <div className="top-bar-divider"></div>

        {/* Section 3: Futures */}
        <div className="top-bar-section">
          <span className="top-bar-label">Fut Price</span>
          <span className="top-bar-value">{futPrice > 0 ? futPrice.toFixed(2) : '-'}</span>
          {futPct !== 0 && (
            <span className={`top-bar-pct ${futPct >= 0 ? 'positive' : 'negative'}`}>
              {futPct > 0 ? '+' : ''}{futPct.toFixed(2)}%
            </span>
          )}
        </div>

        <div className="top-bar-divider"></div>

        {/* Section 4: INDIAVIX */}
        <div className="top-bar-section">
          <span className="top-bar-label">INDIAVIX</span>
          <span className="top-bar-value">{vixPrice > 0 ? vixPrice.toFixed(2) : '-'}</span>
          {vixChange !== 0 && (
            <span className={`top-bar-pct ${vixChange >= 0 ? 'positive' : 'negative'}`}>
              {vixChange > 0 ? '+' : ''}{vixChange.toFixed(2)}
            </span>
          )}
        </div>

        <div className="top-bar-divider"></div>

        {/* Section 5: PCR (Defect 49) */}
        <PcrSummary strikes={strikes} chain={chain} />

        <div className="top-bar-divider"></div>

        {/* Section 5: Strategy and Basket Controls */}
        <div className="top-bar-section" style={{ flexDirection: 'row', gap: '16px', alignItems: 'center' }}>
          <div className="toggle-container" title="Clicking Buy/Sell will add to Basket instead of directly executing">
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Basket Mode</span>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={basketMode}
                onChange={(e) => {
                  setBasketMode(e.target.checked);
                  if (e.target.checked) setStrategyMode(false);
                }}
              />
              <span className="slider round"></span>
            </label>
            {basketMode && basketItems.length > 0 && (
              <button 
                onClick={() => setBasketModalOpen(true)}
                className="btn-mini buy" 
                style={{ marginLeft: '12px', padding: '4px 8px', borderRadius: '4px' }}
              >
                View Basket ({basketItems.length})
              </button>
            )}
          </div>
          
          <div className="toggle-container" title="Clicking Buy/Sell will add to Strategy Builder">
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-blue)' }}>Strategy Builder</span>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={strategyMode}
                onChange={(e) => {
                  setStrategyMode(e.target.checked);
                  if (e.target.checked) setBasketMode(false);
                }}
              />
              <span className="slider round"></span>
            </label>
            {strategyMode && strategyLegs.length > 0 && (
              <button 
                onClick={() => setStrategyModalOpen(true)}
                className="btn-mini buy" 
                style={{ marginLeft: '12px', padding: '4px 8px', borderRadius: '4px', background: 'var(--color-blue)', color: '#fff' }}
              >
                View Strategy ({strategyLegs.length})
              </button>
            )}
            {strategyMode && (
              <select 
                onChange={(e) => { applyTemplate(e.target.value); e.target.value = ""; }}
                style={{ marginLeft: '12px', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', outline: 'none' }}
                value=""
              >
                <option value="" disabled>Load Template...</option>
                <option value="bull_call_spread">Bull Call Spread</option>
                <option value="bear_put_spread">Bear Put Spread</option>
                <option value="bull_put_spread">Bull Put Spread (Credit)</option>
                <option value="bear_call_spread">Bear Call Spread (Credit)</option>
                <option value="straddle">Short Straddle</option>
                <option value="long_straddle">Long Straddle</option>
                <option value="short_strangle">Short Strangle</option>
                <option value="long_strangle">Long Strangle</option>
                <option value="iron_condor">Iron Condor</option>
                <option value="iron_butterfly">Iron Butterfly</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Strategy Builder Modal */}
      {strategyModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '24px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '1200px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', background: 'var(--bg-dark)' }}>
            <button 
              onClick={() => setStrategyModalOpen(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '24px', zIndex: 10 }}
            >&times;</button>
            <OptionsStrategyBuilder 
              legs={strategyLegs}
              spotPrice={spotPrice}
              expiryDate={expiry}
              onRemoveLeg={(idx) => setStrategyLegs(prev => prev.filter((_, i) => i !== idx))}
              onClear={() => setStrategyLegs([])}
              onUpdateLeg={(idx, updatedLeg) => setStrategyLegs(prev => prev.map((l, i) => i === idx ? updatedLeg : l))}
              onExecute={() => {
                if (strategyLegs.length === 0) return;
                strategyLegs.forEach(leg => {
                  const effectiveLotsize = leg.lotsize || getInstantLotsize(leg.symbol) || 1;
                  placeOrder({
                    symbol: leg.symbol,
                    side: leg.side,
                    quantity: (Number(leg.quantity) || 1) * effectiveLotsize,
                    type: 'MARKET',
                    orderType: 'MARKET',
                    product_type: 'INT',
                    price: ''
                  });
                });
                setStrategyLegs([]); // Clear after execution
                setStrategyModalOpen(false); // Close modal
                setStrategyMode(false); // Disable strategy mode
              }}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="option-chain-table-container">
        {loading ? (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Option Chain for {symbol}...</div>
        ) : error ? (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--color-red)' }}>
            Error: {error}
            <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>Try selecting a different symbol from the dropdown above.</div>
          </div>
        ) : expiries.length === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-secondary)' }}>No option chain data available for {symbol}</div>
        ) : strikes.length === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-secondary)' }}>Waiting for option chain data...</div>
        ) : (
        <table className="option-chain-table">
          <thead>
            <tr>
              <th className="header-call" colSpan="10">CALL</th>
              <th className="header-strike"></th>
              <th className="header-put" colSpan="10">PUT</th>
            </tr>
            <tr>
              {/* Calls */}
              <th className="center">OI</th>
              <th className="center">OI Chg</th>
              <th className="center">Delta</th>
              <th className="center">Theta</th>
              <th className="center">Vega</th>
              <th className="center">IV</th>
              <th className="center">Vol</th>
              <th className="center">Chg</th>
              <th className="center">LTP</th>
              <th className="center border-right">BrkEvn(%)</th>
              {/* Strike */}
              <th className="header-strike" style={{ background: '#111' }}>Strike</th>
              {/* Puts */}
              <th className="center border-left">BrkEvn(%)</th>
              <th className="center">LTP</th>
              <th className="center">Chg</th>
              <th className="center">Vol</th>
              <th className="center">IV</th>
              <th className="center">Vega</th>
              <th className="center">Theta</th>
              <th className="center">Delta</th>
              <th className="center">OI Chg</th>
              <th className="center">OI</th>
            </tr>
          </thead>
          <tbody>
            {strikes.map((strike) => (
              <OptionChainRow
                key={strike}
                strike={strike}
                call={chain[strike]?.CE}
                put={chain[strike]?.PE}
                basePrice={basePrice}
                atmStrike={atmStrike}
                atmRowRef={atmRowRef}
                T={T}
                r={r}
                oneClickMode={oneClickMode}
                oneClickMultiplier={oneClickMultiplier}
                handleTrade={handleTrade}
                setAlertModalSymbol={setAlertModalSymbol}
                setChartModalSymbol={setChartModalSymbol}
                openMarketDepthModal={openMarketDepthModal}
                openDomLadderModal={openDomLadderModal}
              />
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
};

const OptionChainView = (props) => {
  return <OptionChainViewInternal {...props} />;
};

export default OptionChainView;


