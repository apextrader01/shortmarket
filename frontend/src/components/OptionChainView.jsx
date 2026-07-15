import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { calculateIV, calculateGreeks } from '../utils/blackScholes';
import OptionsStrategyBuilder from './OptionsStrategyBuilder';
import OptionChainRow from './OptionChainRow';
import { Search, ChevronDown, ChevronRight, BarChart2, List, AlignLeft, Bell, Info } from 'lucide-react';

const API = '';

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

const OptionChainView = () => {
  const [symbol, setSymbol] = useState('NIFTY');
  const [availableSymbols, setAvailableSymbols] = useState([]);
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
          setAvailableSymbols(data);
        }
      } catch (err) {
        console.error('Error fetching symbols', err);
      }
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
  const { basketItems, setBasketModalOpen, oneClickMode, oneClickMultiplier, placeOrder } = useStore();
  const setChartModalSymbol = useStore((state) => state.setChartModalSymbol);
  const setAlertModalSymbol = useStore((state) => state.setAlertModalSymbol);
  const openMarketDepthModal = useStore((state) => state.openMarketDepthModal);
  const openDomLadderModal = useStore((state) => state.openDomLadderModal);

  const atmRowRef = useRef(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [strategyMode, setStrategyMode] = useState(false);
  const [strategyLegs, setStrategyLegs] = useState([]);
  const [strategyModalOpen, setStrategyModalOpen] = useState(false);

  useEffect(() => {
    const fetchChainAndFuture = async () => {
      setLoading(true);
      setError(null);
      setOptionsData({}); // Clear old chain data
      try {
        const idxKey = getIndexKey(symbol);
        const initialToFetch = ['INDIA VIX-NSE'];
        if (idxKey) initialToFetch.push(idxKey);
        useStore.getState().fetchBatchPrices(initialToFetch);

        const res = await fetch(`${API}/api/options/chain/${symbol}`);
        if (!res.ok) {
          const errBody = await res.json().catch(()=>({}));
          throw new Error(errBody.error || 'Failed to fetch option chain');
        }
        const data = await res.json();
        
        setOptionsData(data);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expList = Object.keys(data)
          .filter(exp => new Date(exp) >= today)
          .sort((a, b) => new Date(a) - new Date(b));
        setExpiries(expList);
        if (expList.length > 0) {
          setExpiry(expList[0]);
        }

        // Fetch Future
        const futRes = await fetch(`${API}/api/options/futures/${symbol}`);
        if (futRes.ok) {
          const futData = await futRes.json();
          setFutureData(futData);
          const futKey = `${futData.symbol}-${futData.exchange}`;
          setFutureTokenKey(futKey);
          if (commodities.includes(symbol)) {
            useStore.getState().fetchBatchPrices([futKey]);
          }
        } else {
          setFutureData(null);
          setFutureTokenKey(null);
        }

      } catch (err) {
        console.error(err);
        setError(err.message);
        setOptionsData({});
        setExpiries([]);
        setExpiry('');
      } finally {
        setLoading(false);
      }
    };
    fetchChainAndFuture();
    setHasScrolled(false); // Reset scroll on symbol change
    setInitialSpotPrice(null); // Reset spot price anchor
    setFutureData(null); // Clear old future data so it doesn't anchor to previous symbol's price
  }, [symbol, subscribeToOptionBatch, unsubscribeFromOptionBatch, subscribeToSymbol, unsubscribeFromSymbol]);

  const commodities = [
    'CRUDEOIL', 'CRUDEOILM', 
    'GOLD', 'GOLDM', 'GOLDGUINEA', 'GOLDPETAL', 
    'SILVER', 'SILVERM', 'SILVERMIC', 
    'NATURALGAS', 'NATURALGASM', 
    'COPPER', 'ZINC', 'ZINCMINI', 'LEAD', 'LEADMINI', 'ALUMINIUM', 'ALUMINI', 'MENTHAOIL', 'COTTONCNDY'
  ];

  const getIndexKey = (sym) => {
    if (sym === 'SENSEX' || sym === 'BANKEX') return `${sym}-BSE`;
    if (commodities.includes(sym)) return null; // Commodities use futures price, not spot
    return `${sym}-NSE`;
  };

  const indexKey = getIndexKey(symbol);
  const spotPriceData = useStore(state => indexKey ? state.prices[indexKey] : undefined) || {};
  const spotPrice = spotPriceData.ltp || 0;
  const spotPct = spotPriceData.pct || 0;
  
  const futPriceData = useStore(state => futureTokenKey ? state.prices[futureTokenKey] : undefined);
  const futPrice = futPriceData?.ltp || 0;
  const futPct = futPriceData?.pct || 0;

  const vixData = useStore(state => state.prices['INDIA VIX-NSE']) || {};
  const vixPrice = vixData.ltp || 0;
  const vixPct = vixData.pct || 0;
  const vixChange = vixData.change || 0;

  const basePrice = spotPrice > 0 ? spotPrice : (futPrice > 0 ? futPrice : null);

  useEffect(() => {
    if (basePrice !== null && initialSpotPrice === null) {
      setInitialSpotPrice(basePrice);
    }
  }, [basePrice, initialSpotPrice]);

  useEffect(() => {
    if (!expiry || !optionsData[expiry]) return;

    // Also subscribe to the underlying index for Spot Price
    if (indexKey) {
      subscribeToSymbol(indexKey);
    }
    subscribeToSymbol('INDIA VIX-NSE');

    if (futureData) {
      subscribeToOptionBatch([{ token: futureData.token, exchange: futureData.exchange }]);
    }

    const tokensToSub = [];

    if (initialSpotPrice !== null) {
      const allStrikes = Object.keys(optionsData[expiry]).map(Number).sort((a, b) => a - b);
      if (allStrikes.length > 0) {
        let atmStrike = allStrikes.reduce((prev, curr) => 
          Math.abs(curr - initialSpotPrice) < Math.abs(prev - initialSpotPrice) ? curr : prev
        );
        
        const atmIndex = allStrikes.indexOf(atmStrike);
        // Take 15 strikes below and 15 strikes above ATM (30 total strikes)
        const startIndex = Math.max(0, atmIndex - 15);
        const endIndex = Math.min(allStrikes.length - 1, atmIndex + 15);
        
        const visibleStrikes = allStrikes.slice(startIndex, endIndex + 1);

        visibleStrikes.forEach((strike) => {
          const data = optionsData[expiry]?.[strike];
          if (data?.CE) tokensToSub.push({ ...data.CE, exchange: data.CE.exch_seg, name: symbol });
          if (data?.PE) tokensToSub.push({ ...data.PE, exchange: data.PE.exch_seg, name: symbol });
        });

        if (tokensToSub.length > 0) {
          subscribeToOptionBatch(tokensToSub);
          
          // Instantly fetch snapshot of the visible options so they load immediately
          const uniqueSymbolsToFetch = [];
          if (indexKey) uniqueSymbolsToFetch.push(indexKey);
          uniqueSymbolsToFetch.push('INDIA VIX-NSE');
          if (futureData) uniqueSymbolsToFetch.push(`${futureData.symbol}-${futureData.exchange}`);

          visibleStrikes.forEach((strike) => {
            const data = optionsData[expiry]?.[strike];
            if (data?.CE) uniqueSymbolsToFetch.push(data.CE.symbol);
            if (data?.PE) uniqueSymbolsToFetch.push(data.PE.symbol);
          });

          if (uniqueSymbolsToFetch.length > 0) {
            useStore.getState().fetchBatchPrices(uniqueSymbolsToFetch);
          }
        }
      }
    }

    setHasScrolled(false); // Reset scroll on expiry change

    return () => {
      if (indexKey) unsubscribeFromSymbol(indexKey);
      unsubscribeFromSymbol('INDIA VIX-NSE');
      if (futureData) {
        unsubscribeFromOptionBatch([{ token: futureData.token, exchange: futureData.exchange }]);
      }
      if (tokensToSub.length > 0) {
        unsubscribeFromOptionBatch(tokensToSub);
      }
    };
  }, [expiry, optionsData, symbol, futureData, initialSpotPrice, indexKey, subscribeToOptionBatch, unsubscribeFromOptionBatch, subscribeToSymbol, unsubscribeFromSymbol]);

  const chain = optionsData[expiry] || {};
  
  let strikes = [];
  if (initialSpotPrice !== null && Object.keys(chain).length > 0) {
    const allStrikes = Object.keys(chain).map(Number).sort((a, b) => a - b);
    let atmStrike = allStrikes.reduce((prev, curr) => 
      Math.abs(curr - initialSpotPrice) < Math.abs(prev - initialSpotPrice) ? curr : prev
    );
    const atmIndex = allStrikes.indexOf(atmStrike);
    const startIndex = Math.max(0, atmIndex - 15);
    const endIndex = Math.min(allStrikes.length - 1, atmIndex + 15);
    strikes = allStrikes.slice(startIndex, endIndex + 1);
  }

  // Auto-scroll to ATM strike when data is available
  useEffect(() => {
    if (!hasScrolled && atmRowRef.current && spotPrice > 0) {
      setTimeout(() => {
        if (atmRowRef.current) {
          const container = document.querySelector('.option-chain-table-container');
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const rowRect = atmRowRef.current.getBoundingClientRect();
            container.scrollBy({
              top: (rowRect.top - containerRect.top) - (containerRect.height / 2) + (rowRect.height / 2),
              behavior: 'smooth'
            });
          }
        }
      }, 100);
      setHasScrolled(true);
    }
  }, [spotPrice, hasScrolled, strikes]);

  const handleTrade = (opt, type, optionType, iv) => {
    if (!opt) return;
    
    // Add to strategy builder if in strategy mode
    if (strategyMode) {
      const currentPrices = useStore.getState().prices;
      const priceData = currentPrices[opt.symbol] || {};
      const price = priceData.ltp || 0;
      setStrategyLegs(prev => [...prev, {
        optionType,
        strike: parseFloat(opt.strike),
        price: parseFloat(price),
        side: type === 'BUY' ? 'BUY' : 'SELL',
        quantity: opt.lotsize ? parseInt(opt.lotsize) : 1,
        iv: iv || 0,
        symbol: opt.symbol
      }]);
      return;
    }
    
    if (basketMode) {
      addToBasket({
        symbol: opt.symbol,
        side: type === 'BUY' ? 'BUY' : 'SELL',
        quantity: 1,
        lotsize: opt.lotsize ? parseInt(opt.lotsize) : 1,
        orderType: 'MARKET',
        price: ''
      });
      // Modal opens manually via the "View Basket" button
      // Modal opens manually via the "View Basket" button
    } else if (oneClickMode) {
      // ONE-CLICK SCALPER MODE: Bypass modal, execute instantly at Market Price
      const lotsize = opt.lotsize ? parseInt(opt.lotsize) : 1;
      const finalQuantity = lotsize * (oneClickMultiplier || 1);
      const currentPrices = useStore.getState().prices;
      const livePrice = currentPrices[opt.symbol]?.ltp || 0;
      
      const payload = {
        symbol: opt.symbol,
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
      openOrderModal(opt.symbol, type === 'BUY' ? 'BUY' : 'SELL', opt.lotsize ? parseInt(opt.lotsize) : 1);
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

  // Find ATM strike (closest to spotPrice)
  let atmStrike = null;
  if (basePrice > 0 && strikes.length > 0) {
    atmStrike = strikes.reduce((prev, curr) => 
      Math.abs(curr - basePrice) < Math.abs(prev - basePrice) ? curr : prev
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
        price: legData.ltp,
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
    <div className="option-chain-container">
      {/* Header */}
      <div className="option-chain-top-bar">
        {/* Section 1: Search & Spot */}
        <div className="top-bar-section">
          <SymbolDropdown 
            value={symbol}
            options={availableSymbols.length > 0 ? availableSymbols : [symbol]}
            onChange={setSymbol}
          />
          
          <span className="top-bar-price" style={{ marginLeft: '4px' }}>{spotPrice > 0 ? spotPrice.toFixed(2) : '-'}</span>
          <span className={`top-bar-pct ${spotPct >= 0 ? 'positive' : 'negative'}`}>
            {spotPct > 0 ? '+' : ''}{spotPct.toFixed(2)}%
          </span>

          <div className="top-bar-icons">
            <button className="icon-btn" title="View Chart"><i className="fi fi-rr-chart-line-up"></i></button>
            <button className="icon-btn info-btn" title="Information">Info</button>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '24px' }}>
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
                  placeOrder({
                    symbol: leg.symbol,
                    side: leg.side,
                    quantity: leg.quantity,
                    orderType: 'MARKET',
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
        ) : initialSpotPrice === null ? (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-secondary)' }}>Waiting for market data...</div>
        ) : (
        <table className="option-chain-table">
          <thead>
            <tr>
              <th className="header-call" colSpan="8">CALL</th>
              <th className="header-strike"></th>
              <th className="header-put" colSpan="8">PUT</th>
            </tr>
            <tr>
              {/* Calls */}
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

export default OptionChainView;
