import { useShallow } from 'zustand/react/shallow';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore, API } from '../store';
import { getInstantLotsize } from '../utils/lotsizeHelper';
import { calculateIV, calculateGreeks } from '../utils/blackScholes';
import OptionsStrategyBuilder from './OptionsStrategyBuilder';
import OptionChainRow from './OptionChainRow';
import OptionChainMobile from './OptionChainMobile';
import { Clock, ChevronLeft, SlidersHorizontal, Activity, Zap, Layers, ChevronDown } from 'lucide-react';

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
    case 'MIDCPNIFTY': return ['NSE:MIDCPNIFTY-INDEX', 'MIDCPNIFTY-INDEX', 'MIDCPNIFTY-NSE', 'NIFTY MID SELECT', 'MIDCPNIFTY'];
    default: return [`NSE:${sym}-INDEX`, `${sym}-NSE`, `NSE:${sym}-EQ`, `BSE:${sym}`, `NSE:${sym}`, `${sym}-EQ`, sym];
  }
};

const getIndexKey = (sym) => {
  switch (sym) {
    case 'NIFTY': return 'NSE:NIFTY50-INDEX';
    case 'BANKNIFTY': return 'NSE:NIFTYBANK-INDEX';
    case 'FINNIFTY': return 'NSE:FINNIFTY-INDEX';
    case 'SENSEX': return 'BSE:SENSEX-INDEX';
    case 'BANKEX': return 'BSE:BANKEX-INDEX';
    case 'MIDCPNIFTY': return 'NSE:MIDCPNIFTY-INDEX';
    default: return `NSE:${sym}-INDEX`;
  }
};

export const getMaxSpanForSymbol = (symbol) => {
  const sym = (symbol || '').toUpperCase().trim();
  if (sym === 'NIFTY' || sym === 'SENSEX' || sym === 'NIFTY 50' || sym === 'BSE SENSEX') {
    return 20;
  }
  if (sym === 'BANKNIFTY' || sym === 'NIFTY BANK') {
    return 15;
  }
  if (sym === 'FINNIFTY' || sym === 'BANKEX' || sym === 'NIFTY FINANCIAL SERVICES' || sym === 'BSE BANKEX') {
    return 10;
  }
  return 15;
};

export const getAvailableRangesForSymbol = (symbol) => {
  const max = getMaxSpanForSymbol(symbol);
  if (max >= 20) return ['10', '15', '20', 'ALL'];
  if (max >= 15) return ['10', '15', 'ALL'];
  if (max >= 10) return ['10', 'ALL'];
  return ['10', 'ALL'];
};

export const resolveOptionLivePrice = (legOrOpt, storePrices) => {
  if (!legOrOpt) return 0;
  const prices = storePrices || useStore.getState().prices || {};
  const sym = legOrOpt.symbol;
  const token = legOrOpt.token ? String(legOrOpt.token) : null;
  const raw = sym ? sym.replace(/^[A-Z0-9]+:/, '') : null;
  const pref = sym && !sym.includes(':') ? `${legOrOpt.exch_seg || 'NSE'}:${sym}` : sym;
  const key = sym ? (sym.includes('-') ? sym : `${sym}-${legOrOpt.exch_seg || 'NSE'}`) : null;

  const match = (sym && prices[sym]) ||
                (token && prices[token]) ||
                (raw && prices[raw]) ||
                (pref && prices[pref]) ||
                (key && prices[key]);

  if (match?.ltp && Number(match.ltp) > 0) return Number(match.ltp);
  if (legOrOpt.livePrice && Number(legOrOpt.livePrice) > 0) return Number(legOrOpt.livePrice);
  if (legOrOpt.price && Number(legOrOpt.price) > 0) return Number(legOrOpt.price);
  if (legOrOpt.ltp && Number(legOrOpt.ltp) > 0) return Number(legOrOpt.ltp);
  if (legOrOpt.close && Number(legOrOpt.close) > 0) return Number(legOrOpt.close);
  if (legOrOpt.last_price && Number(legOrOpt.last_price) > 0) return Number(legOrOpt.last_price);
  return 0;
};

export const STRATEGY_TEMPLATES = [
  {
    category: 'Single Leg (1 Strike)',
    items: [
      { id: 'buy_call', name: 'Buy Call (ATM CE)', desc: 'Bullish • 1 Leg • Buy ATM Call', tag: 'BULLISH', tagColor: '#10b981' },
      { id: 'sell_put', name: 'Sell Put (ATM PE)', desc: 'Bullish • 1 Leg • Sell ATM Put', tag: 'BULLISH', tagColor: '#10b981' },
      { id: 'buy_put', name: 'Buy Put (ATM PE)', desc: 'Bearish • 1 Leg • Buy ATM Put', tag: 'BEARISH', tagColor: '#ef4444' },
      { id: 'sell_call', name: 'Sell Call (ATM CE)', desc: 'Bearish • 1 Leg • Sell ATM Call', tag: 'BEARISH', tagColor: '#ef4444' }
    ]
  },
  {
    category: 'Spreads (2 Strikes)',
    items: [
      { id: 'bull_call_spread', name: 'Bull Call Spread', desc: 'Bullish Debit Spread (Buy ATM, Sell OTM Call)', tag: 'DEBIT', tagColor: '#38bdf8' },
      { id: 'bear_put_spread', name: 'Bear Put Spread', desc: 'Bearish Debit Spread (Buy ATM, Sell OTM Put)', tag: 'DEBIT', tagColor: '#38bdf8' },
      { id: 'bull_put_spread', name: 'Bull Put Spread (Credit)', desc: 'Bullish Credit Spread (Sell OTM Put, Buy deeper OTM)', tag: 'CREDIT', tagColor: '#10b981' },
      { id: 'bear_call_spread', name: 'Bear Call Spread (Credit)', desc: 'Bearish Credit Spread (Sell OTM Call, Buy deeper OTM)', tag: 'CREDIT', tagColor: '#10b981' }
    ]
  },
  {
    category: 'Straddles & Strangles',
    items: [
      { id: 'short_straddle', name: 'Short Straddle', desc: 'Neutral • Sell ATM CE + Sell ATM PE', tag: 'NEUTRAL', tagColor: '#f59e0b' },
      { id: 'long_straddle', name: 'Long Straddle', desc: 'Volatility • Buy ATM CE + Buy ATM PE', tag: 'VOLATILITY', tagColor: '#a855f7' },
      { id: 'short_strangle', name: 'Short Strangle', desc: 'Neutral • Sell OTM CE + Sell OTM PE', tag: 'NEUTRAL', tagColor: '#f59e0b' },
      { id: 'long_strangle', name: 'Long Strangle', desc: 'Volatility • Buy OTM CE + Buy OTM PE', tag: 'VOLATILITY', tagColor: '#a855f7' }
    ]
  },
  {
    category: 'Multi-Leg (4 Strikes)',
    items: [
      { id: 'iron_condor', name: 'Iron Condor', desc: 'Neutral Defined Risk (Sell OTM Put/Call, Buy wings)', tag: 'DEFINED RISK', tagColor: '#38bdf8' },
      { id: 'iron_butterfly', name: 'Iron Butterfly', desc: 'Neutral Defined Risk (Sell ATM Straddle, Buy wings)', tag: 'DEFINED RISK', tagColor: '#38bdf8' }
    ]
  }
];

export const StrategyTemplateDropdown = ({ onSelect, alignRight = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '6px',
          padding: '5px 10px',
          fontSize: '11.5px',
          fontWeight: '700',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <Layers size={12} style={{ color: 'var(--color-blue, #2563eb)' }} />
        <span>Templates</span>
        <ChevronDown size={11} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            ...(alignRight ? { right: 0 } : { left: 0 }),
            width: '290px',
            maxHeight: '390px',
            overflowY: 'auto',
            background: 'var(--bg-panel, #0f172a)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '10px',
            padding: '6px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7)',
            zIndex: 1050,
            backdropFilter: 'blur(12px)'
          }}
        >
          {STRATEGY_TEMPLATES.map((cat, ci) => (
            <div key={ci} style={{ marginBottom: '8px' }}>
              <div style={{ padding: '4px 8px', fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {cat.category}
              </div>
              {cat.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item.id);
                    setIsOpen(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    transition: 'background 0.12s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{item.name}</span>
                    <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', color: item.tagColor }}>
                      {item.tag}
                    </span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{item.desc}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
    const handleSetSymbol = (e) => {
      if (e?.detail) setSymbol(e.detail);
    };
    window.addEventListener('skandx_set_option_symbol', handleSetSymbol);
    return () => window.removeEventListener('skandx_set_option_symbol', handleSetSymbol);
  }, []);

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

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [showGreeks, setShowGreeks] = useState(true);
  const [strikeRange, setStrikeRange] = useState(() => String(getMaxSpanForSymbol('NIFTY')));

  useEffect(() => {
    const maxS = getMaxSpanForSymbol(symbol);
    setStrikeRange(String(maxS));
  }, [symbol]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  const effectiveSpotPrice = (basePrice > 0 ? basePrice : initialSpotPrice) || (allStrikes.length > 0 ? allStrikes[Math.floor(allStrikes.length / 2)] : null);

  // Memoized strike window based on strikeRange and index-specific caps:
  // - NIFTY & SENSEX: max 20 strikes from ATM (total 41)
  // - BANKNIFTY: max 15 strikes from ATM (total 31)
  // - FINNIFTY & BANKEX: max 10 strikes from ATM (total 21)
  const strikes = useMemo(() => {
    if (!effectiveSpotPrice || allStrikes.length === 0) return [];
    const atmStrike = allStrikes.reduce((prev, curr) => 
      Math.abs(curr - effectiveSpotPrice) < Math.abs(prev - effectiveSpotPrice) ? curr : prev
    );
    const atmIndex = allStrikes.indexOf(atmStrike);
    const maxSpan = getMaxSpanForSymbol(symbol);
    let span = maxSpan;
    if (strikeRange === '10') span = Math.min(10, maxSpan);
    else if (strikeRange === '15') span = Math.min(15, maxSpan);
    else if (strikeRange === '20') span = Math.min(20, maxSpan);
    else if (strikeRange === 'ALL') span = allStrikes.length;
    else span = Math.min(parseInt(strikeRange, 10) || maxSpan, maxSpan);

    const startIndex = Math.max(0, atmIndex - span);
    const endIndex = Math.min(allStrikes.length - 1, atmIndex + span);
    return allStrikes.slice(startIndex, endIndex + 1);
  }, [effectiveSpotPrice, allStrikes, strikeRange, symbol]);

  // Max Pain calculation: strike minimizing cumulative option seller loss
  const maxPain = useMemo(() => {
    if (!allStrikes || allStrikes.length === 0 || !chain) return null;
    const prices = useStore.getState().prices;
    const strikeData = [];
    for (const s of allStrikes) {
      const c = chain[s]?.CE;
      const p = chain[s]?.PE;
      let cOi = 0;
      let pOi = 0;
      if (c) {
        const cData = prices[c.symbol] || (c.symbol?.includes(':') ? prices[c.symbol.split(':')[1]] : null);
        cOi = Number(cData?.oi ?? c.oi ?? 0);
      }
      if (p) {
        const pData = prices[p.symbol] || (p.symbol?.includes(':') ? prices[p.symbol.split(':')[1]] : null);
        pOi = Number(pData?.oi ?? p.oi ?? 0);
      }
      if (cOi > 0 || pOi > 0) {
        strikeData.push({ strike: s, cOi, pOi });
      }
    }
    if (strikeData.length === 0) return null;

    let minLoss = Infinity;
    let bestStrike = null;

    for (const target of strikeData) {
      let currentLoss = 0;
      for (const item of strikeData) {
        if (target.strike > item.strike) {
          currentLoss += item.cOi * (target.strike - item.strike);
        } else if (target.strike < item.strike) {
          currentLoss += item.pOi * (item.strike - target.strike);
        }
      }
      if (currentLoss < minLoss) {
        minLoss = currentLoss;
        bestStrike = target.strike;
      }
    }
    return bestStrike;
  }, [allStrikes, chain, expiry]);

  // Max Call & Put OI for depth bar visualization and live PCR value (memoized, zero re-render loops)
  const { maxCallOI, maxPutOI, pcr } = useMemo(() => {
    let maxC = 1;
    let maxP = 1;
    let callOi = 0;
    let putOi = 0;
    const currentPrices = useStore.getState().prices;
    (strikes || []).forEach(s => {
      const c = chain[s]?.CE;
      const p = chain[s]?.PE;
      if (c) {
        const cData = currentPrices[c.symbol] || (c.symbol?.includes(':') ? currentPrices[c.symbol.split(':')[1]] : null);
        const val = Number(cData?.oi ?? c.oi ?? 0);
        if (val > maxC) maxC = val;
        if (val > 0) callOi += val;
      }
      if (p) {
        const pData = currentPrices[p.symbol] || (p.symbol?.includes(':') ? currentPrices[p.symbol.split(':')[1]] : null);
        const val = Number(pData?.oi ?? p.oi ?? 0);
        if (val > maxP) maxP = val;
        if (val > 0) putOi += val;
      }
    });
    const computedPcr = callOi > 0 ? (putOi / callOi).toFixed(2) : (putOi > 0 ? '∞' : '1.00');
    return { maxCallOI: maxC, maxPutOI: maxP, pcr: computedPcr };
  }, [strikes, chain]);

  const isIndex = useMemo(() => ALLOWED_INDEX_SYMBOLS.includes(symbol), [symbol]);

  // Compute Synthetic Futures Price from Put-Call Parity (F = K + C - P) across ATM strikes
  const synthFutPrice = useStore(useCallback(state => {
    if (!strikes || strikes.length === 0 || !chain) return 0;
    const target = spotPrice > 0 ? spotPrice : effectiveSpotPrice;
    if (!target) return 0;

    const sorted = [...strikes].sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
    let sumF = 0;
    let count = 0;

    for (const s of sorted) {
      const c = chain[s]?.CE;
      const p = chain[s]?.PE;
      if (!c || !p) continue;

      const cData = state.prices[c.symbol] || (c.symbol?.includes(':') ? state.prices[c.symbol.split(':')[1]] : null);
      const pData = state.prices[p.symbol] || (p.symbol?.includes(':') ? state.prices[p.symbol.split(':')[1]] : null);

      const cLtp = Number(cData?.ltp ?? c.ltp ?? 0);
      const pLtp = Number(pData?.ltp ?? p.ltp ?? 0);

      if (cLtp > 0 && pLtp > 0) {
        sumF += (s + cLtp - pLtp);
        count++;
        if (count >= 3) break;
      }
    }

    if (count > 0) {
      return Number((sumF / count).toFixed(2));
    }
    return 0;
  }, [strikes, chain, spotPrice, effectiveSpotPrice]));

  const pricingPrice = useMemo(() => {
    if (synthFutPrice > 0) return synthFutPrice;
    if (futPrice > 0) return futPrice;
    return basePrice;
  }, [synthFutPrice, futPrice, basePrice]);

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
      const livePrice = resolveOptionLivePrice({ symbol: optKey, ...opt });
      setStrategyLegs(prev => [...prev, {
        optionType,
        strike: parseFloat(opt.strike),
        price: livePrice > 0 ? livePrice : (parseFloat(opt.ltp || 0)),
        side: type === 'BUY' ? 'BUY' : 'SELL',
        quantity: 1,
        lotsize: opt.lotsize ? parseInt(opt.lotsize) : (getInstantLotsize(optKey) || 1),
        iv: iv || 0.2,
        symbol: optKey,
        token: opt.token
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
    if (!templateId || !optionsData || Object.keys(optionsData).length === 0) return;
    
    const targetStrikeList = (allStrikes && allStrikes.length > 0) ? allStrikes : strikes;
    if (targetStrikeList.length === 0) return;

    let currentAtm = atmStrike;
    if (!currentAtm && targetSpot > 0) {
      currentAtm = targetStrikeList.reduce((prev, curr) => 
        Math.abs(curr - targetSpot) < Math.abs(prev - targetSpot) ? curr : prev
      );
    }
    if (!currentAtm) currentAtm = targetStrikeList[Math.floor(targetStrikeList.length / 2)];

    const atmIndex = targetStrikeList.indexOf(currentAtm);
    if (atmIndex === -1) return;

    let newLegs = [];

    const getLeg = (strikeIdx, type, side) => {
      if (strikeIdx < 0 || strikeIdx >= targetStrikeList.length) return null;
      const strike = targetStrikeList[strikeIdx];
      const option = optionsData[expiry]?.[strike];
      if (!option) return null;
      const legData = type === 'CE' ? option.CE : option.PE;
      if (!legData) return null;

      const storePrices = useStore.getState().prices || {};
      const liveLtp = resolveOptionLivePrice(legData, storePrices);
      let liveIv = 0.2;
      if (liveLtp > 0 && targetSpot > 0) {
        liveIv = calculateIV(type, liveLtp, targetSpot, strike, T, r, isIndex);
        if (!liveIv || liveIv <= 0) liveIv = 0.2;
      }

      return {
        symbol: legData.symbol,
        token: legData.token,
        strike,
        optionType: type,
        side,
        quantity: 1,
        lotsize: legData.lotsize ? parseInt(legData.lotsize) : (getInstantLotsize(legData.symbol) || 1),
        price: liveLtp,
        iv: liveIv
      };
    };

    if (templateId === 'buy_call') {
      const leg = getLeg(atmIndex, 'CE', 'BUY');
      if (leg) newLegs.push(leg);
    } else if (templateId === 'buy_put') {
      const leg = getLeg(atmIndex, 'PE', 'BUY');
      if (leg) newLegs.push(leg);
    } else if (templateId === 'sell_call') {
      const leg = getLeg(atmIndex, 'CE', 'SELL');
      if (leg) newLegs.push(leg);
    } else if (templateId === 'sell_put') {
      const leg = getLeg(atmIndex, 'PE', 'SELL');
      if (leg) newLegs.push(leg);
    } else if (templateId === 'bull_call_spread') {
      const buyLeg = getLeg(atmIndex, 'CE', 'BUY');
      const sellLeg = getLeg(atmIndex + 1, 'CE', 'SELL');
      if (buyLeg) newLegs.push(buyLeg);
      if (sellLeg) newLegs.push(sellLeg);
    } else if (templateId === 'bear_put_spread') {
      const buyLeg = getLeg(atmIndex, 'PE', 'BUY');
      const sellLeg = getLeg(atmIndex - 1, 'PE', 'SELL');
      if (buyLeg) newLegs.push(buyLeg);
      if (sellLeg) newLegs.push(sellLeg);
    } else if (templateId === 'bull_put_spread') {
      const sellLeg = getLeg(atmIndex - 1, 'PE', 'SELL');
      const buyLeg = getLeg(atmIndex - 2, 'PE', 'BUY');
      if (sellLeg) newLegs.push(sellLeg);
      if (buyLeg) newLegs.push(buyLeg);
    } else if (templateId === 'bear_call_spread') {
      const sellLeg = getLeg(atmIndex + 1, 'CE', 'SELL');
      const buyLeg = getLeg(atmIndex + 2, 'CE', 'BUY');
      if (sellLeg) newLegs.push(sellLeg);
      if (buyLeg) newLegs.push(buyLeg);
    } else if (templateId === 'straddle' || templateId === 'short_straddle') {
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
      const buyPe = getLeg(atmIndex - 2, 'PE', 'BUY');
      const sellPe = getLeg(atmIndex - 1, 'PE', 'SELL');
      const sellCe = getLeg(atmIndex + 1, 'CE', 'SELL');
      const buyCe = getLeg(atmIndex + 2, 'CE', 'BUY');
      if (buyPe) newLegs.push(buyPe);
      if (sellPe) newLegs.push(sellPe);
      if (sellCe) newLegs.push(sellCe);
      if (buyCe) newLegs.push(buyCe);
    }

    if (newLegs.length > 0) {
      setStrategyLegs(newLegs);
      setStrategyMode(true);
      setStrategyModalOpen(true);
    }
  };

  if (isMobile) {
    return (
      <div className="option-chain-container mobile-view" style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Option Chain for {symbol}...</div>
        ) : error ? (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--color-red)' }}>
            Error: {error}
          </div>
        ) : (
          <OptionChainMobile
            symbol={symbol}
            setSymbol={setSymbol}
            expiry={expiry}
            setExpiry={setExpiry}
            expiries={expiries}
            strikes={strikes}
            chain={chain}
            spotPrice={spotPrice}
            spotPct={spotPct}
            futPrice={futPrice}
            futPct={futPct}
            synthFutPrice={synthFutPrice}
            vixPrice={vixPrice}
            vixChange={vixChange}
            atmStrike={atmStrike}
            basePrice={basePrice}
            pricingPrice={pricingPrice}
            maxPain={maxPain}
            pcr={pcr}
            maxCallOI={maxCallOI}
            maxPutOI={maxPutOI}
            T={T}
            r={r}
            isIndex={isIndex}
            handleTrade={handleTrade}
            oneClickMode={oneClickMode}
            oneClickMultiplier={oneClickMultiplier}
            setAlertModalSymbol={setAlertModalSymbol}
            setChartModalSymbol={setChartModalSymbol}
            openMarketDepthModal={openMarketDepthModal}
            addToBasket={addToBasket}
          />
        )}
      </div>
    );
  }

  return (
    <div className="option-chain-container glass-panel">
      {/* Header */}
      <div className="option-chain-top-bar">
        {/* Section 1: Major Index Switcher & Spot Price */}
        <div className="top-bar-section" style={{ gap: '10px' }}>
          <div className="option-chain-pill-group">
            {ALLOWED_INDEX_SYMBOLS.map((idxSym) => {
              const isSelected = symbol === idxSym;
              return (
                <button
                  key={idxSym}
                  type="button"
                  onClick={() => setSymbol(idxSym)}
                  className={`option-chain-index-btn ${isSelected ? 'active' : ''}`}
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

        {/* Section 3.5: Synthetic Futures Price (Put-Call Parity) */}
        <div className="top-bar-section" title="Synthetic Futures Price derived via Put-Call Parity from ATM options">
          <span className="top-bar-label">Synth Fut</span>
          <span className="top-bar-value" style={{ fontWeight: '700', color: 'var(--color-blue, #2563eb)' }}>
            {synthFutPrice > 0 ? synthFutPrice.toFixed(2) : '-'}
          </span>
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

        {/* Section 5.5: Max Pain */}
        {maxPain > 0 && (
          <>
            <div className="top-bar-divider"></div>
            <div className="top-bar-section" title="Strike price where option sellers face minimal cumulative loss">
              <span className="top-bar-label">Max Pain</span>
              <span className="top-bar-value" style={{ fontWeight: '800', color: 'var(--color-yellow, #d97706)' }}>
                {maxPain}
              </span>
            </div>
          </>
        )}

        <div className="top-bar-divider"></div>

        {/* Section 6: Display Controls (Greeks Toggle & Strike Range Filter) */}
        <div className="top-bar-section" style={{ flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowGreeks(!showGreeks)}
            className={`option-chain-greeks-btn ${showGreeks ? 'active' : ''}`}
            title="Toggle Delta, Theta, Vega, and IV columns"
          >
            <SlidersHorizontal size={12} />
            Greeks {showGreeks ? 'ON' : 'OFF'}
          </button>

          <div className="option-chain-range-group">
            {getAvailableRangesForSymbol(symbol).map(rng => (
              <button
                key={rng}
                type="button"
                onClick={() => setStrikeRange(rng)}
                className={`option-chain-range-btn ${strikeRange === rng ? 'active' : ''}`}
              >
                {rng === 'ALL' ? 'All' : `±${rng}`}
              </button>
            ))}
          </div>
        </div>

        <div className="top-bar-divider"></div>

        {/* Section 7: Strategy and Basket Controls */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px' }}>
              <button 
                type="button"
                onClick={() => {
                  setStrategyMode(true);
                  setStrategyModalOpen(true);
                }}
                className="btn-mini" 
                style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: strategyLegs.length > 0 ? 'var(--color-blue, #2563eb)' : 'rgba(37, 99, 235, 0.15)',
                  color: strategyLegs.length > 0 ? '#ffffff' : 'var(--color-blue, #38bdf8)',
                  border: '1px solid rgba(37, 99, 235, 0.4)',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title="Open Strategy Builder Modal"
              >
                <Zap size={12} />
                <span>Builder {strategyLegs.length > 0 ? `(${strategyLegs.length})` : ''}</span>
              </button>

              <StrategyTemplateDropdown onSelect={applyTemplate} alignRight={true} />
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Builder Modal */}
      {strategyModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '1260px', maxHeight: '94vh', overflowY: 'auto', position: 'relative', background: 'var(--bg-panel, #0f172a)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
            <button 
              onClick={() => setStrategyModalOpen(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, transition: 'all 0.2s' }}
              title="Close Builder"
            >&times;</button>
            <OptionsStrategyBuilder 
              legs={strategyLegs}
              spotPrice={spotPrice > 0 ? spotPrice : effectiveSpotPrice}
              expiryDate={expiry}
              symbol={symbol}
              strikes={strikes}
              allStrikes={allStrikes}
              chain={chain}
              onSelectTemplate={applyTemplate}
              onRemoveLeg={(idx) => setStrategyLegs(prev => prev.filter((_, i) => i !== idx))}
              onClear={() => setStrategyLegs([])}
              onUpdateLeg={(idx, updatedLeg) => setStrategyLegs(prev => prev.map((l, i) => i === idx ? updatedLeg : l))}
              onAddLeg={() => {
                const targetStrikeList = (allStrikes && allStrikes.length > 0) ? allStrikes : strikes;
                const strikeToAdd = atmStrike || (targetStrikeList.length > 0 ? targetStrikeList[Math.floor(targetStrikeList.length / 2)] : null);
                if (!strikeToAdd) return;
                const opt = chain[strikeToAdd]?.CE || chain[strikeToAdd]?.PE;
                if (!opt) return;
                const live = resolveOptionLivePrice(opt);
                setStrategyLegs(prev => [...prev, {
                  symbol: opt.symbol,
                  token: opt.token,
                  strike: strikeToAdd,
                  optionType: 'CE',
                  side: 'BUY',
                  quantity: 1,
                  lotsize: opt.lotsize ? parseInt(opt.lotsize) : (getInstantLotsize(opt.symbol) || 1),
                  price: live,
                  iv: 0.2
                }]);
              }}
              onClose={() => setStrategyModalOpen(false)}
              onExecute={async (currentLegs, legMultiplier = 1) => {
                const token = localStorage.getItem('token');
                const user = useStore.getState().user;
                if (!token || !user) {
                  useStore.getState().showToast("Please log in to execute option strategies.", "warning", "Login Required");
                  return;
                }

                const legsToExecute = (currentLegs && currentLegs.length > 0) ? currentLegs : strategyLegs;
                if (!legsToExecute || legsToExecute.length === 0) {
                  useStore.getState().showToast("No legs in Strategy Builder to execute.", "warning", "Empty Strategy");
                  return;
                }

                const showToast = useStore.getState().showToast;
                const results = [];

                for (let i = 0; i < legsToExecute.length; i++) {
                  const leg = legsToExecute[i];
                  const effectiveLotsize = leg.lotsize || getInstantLotsize(leg.symbol) || 1;
                  const totalQty = (Number(leg.quantity) || 1) * (Number(legMultiplier) || 1) * effectiveLotsize;
                  const hasCustomPrice = leg.customPrice !== undefined && leg.customPrice !== null && leg.customPrice !== '' && Number(leg.customPrice) > 0;
                  const orderType = hasCustomPrice ? 'LIMIT' : 'MARKET';
                  const orderPrice = hasCustomPrice ? Number(leg.customPrice) : (leg.price || '');

                  const payload = {
                    symbol: leg.symbol,
                    side: leg.side,
                    quantity: totalQty,
                    type: orderType,
                    orderType: orderType,
                    product_type: 'INT',
                    price: orderPrice
                  };

                  try {
                    let res = await placeOrder(payload);
                    
                    // If regular order was rejected because market is closed, automatically try placing as AMO (After Market Order)
                    if (!res?.success && res?.error && (res.error.toLowerCase().includes('select amo') || res.error.toLowerCase().includes('closed'))) {
                      const amoPayload = { ...payload, is_amo: true, order_variety: 'AMO' };
                      res = await placeOrder(amoPayload);
                    }

                    results.push({ leg, res });
                  } catch (err) {
                    results.push({ leg, res: { success: false, error: err.message || 'Execution failed' } });
                  }
                }

                const failed = results.filter(r => !r.res?.success);
                const succeeded = results.filter(r => r.res?.success);

                if (failed.length === 0) {
                  // All legs placed successfully!
                  const amoCount = succeeded.filter(r => r.res?.status === 'AMO_PENDING').length;
                  if (amoCount > 0) {
                    showToast(`Strategy Queued! All ${succeeded.length} legs placed as AMO for market open.`, 'info', 'AMO Orders Queued');
                  } else {
                    showToast(`Strategy Executed! All ${succeeded.length} legs placed successfully.`, 'success', 'Strategy Filled');
                  }
                  setStrategyLegs([]); // Clear after execution
                  setStrategyModalOpen(false); // Close modal
                  setStrategyMode(false); // Disable strategy mode
                } else if (succeeded.length > 0) {
                  // Partial execution
                  const firstErr = failed[0].res?.error || 'Order rejected';
                  showToast(`Partial Fill: ${succeeded.length} legs placed, ${failed.length} failed. Error: ${firstErr}`, 'warning', 'Partial Fill');
                  // Keep only failed legs so user can retry or adjust
                  setStrategyLegs(failed.map(f => f.leg));
                } else {
                  // All failed - DO NOT close modal or clear legs, show the exact rejection error!
                  const firstErr = failed[0].res?.error || 'Order rejected by risk management.';
                  showToast(`Execution Failed: ${firstErr}`, 'error', 'Order Rejected');
                }
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
              <th className="header-call" colSpan={showGreeks ? 10 : 6}>CALL</th>
              <th className="header-strike"></th>
              <th className="header-put" colSpan={showGreeks ? 10 : 6}>PUT</th>
            </tr>
            <tr>
              {/* Calls */}
              <th className="center">OI</th>
              <th className="center">OI Chg</th>
              {showGreeks && (
                <>
                  <th className="center">Delta</th>
                  <th className="center">Theta</th>
                  <th className="center">Vega</th>
                  <th className="center">IV</th>
                </>
              )}
              <th className="center">Vol</th>
              <th className="center">Chg</th>
              <th className="center">LTP</th>
              <th className="center border-right">BrkEvn(%)</th>
              {/* Strike */}
              <th className="header-strike">Strike</th>
              {/* Puts */}
              <th className="center border-left">BrkEvn(%)</th>
              <th className="center">LTP</th>
              <th className="center">Chg</th>
              <th className="center">Vol</th>
              {showGreeks && (
                <>
                  <th className="center">IV</th>
                  <th className="center">Vega</th>
                  <th className="center">Theta</th>
                  <th className="center">Delta</th>
                </>
              )}
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
                pricingPrice={pricingPrice}
                isIndex={isIndex}
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
                maxCallOI={maxCallOI}
                maxPutOI={maxPutOI}
                showGreeks={showGreeks}
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


