import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { calculateIV, calculateGreeks } from '../utils/blackScholes';

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
        <span>{value}</span>
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

  const prices = useStore((state) => state.prices);
  const openOrderModal = useStore((state) => state.openOrderModal);
  const subscribeToOptionBatch = useStore((state) => state.subscribeToOptionBatch);
  const unsubscribeFromOptionBatch = useStore((state) => state.unsubscribeFromOptionBatch);
  const subscribeToSymbol = useStore((state) => state.subscribeToSymbol);
  const unsubscribeFromSymbol = useStore((state) => state.unsubscribeFromSymbol);

  const atmRowRef = useRef(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const fetchChain = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/options/chain/${symbol}`);
        if (!res.ok) throw new Error('Failed to fetch option chain');
        const data = await res.json();
        
        setOptionsData(data);
        const expList = Object.keys(data).sort((a, b) => new Date(a) - new Date(b));
        setExpiries(expList);
        if (expList.length > 0) {
          setExpiry(expList[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchChain();
    setHasScrolled(false); // Reset scroll on symbol change
  }, [symbol]);

  useEffect(() => {
    if (!expiry || !optionsData[expiry]) return;

    const strikes = Object.keys(optionsData[expiry]);
    const tokensToSub = [];

    // Also subscribe to the underlying index for Spot Price
    const getIndexKey = (sym) => {
      if (sym === 'SENSEX' || sym === 'BANKEX') return `${sym}-BSE`;
      if (sym === 'CRUDEOIL' || sym === 'GOLD' || sym === 'SILVER' || sym === 'NATURALGAS') return `${sym}-MCX`;
      return `${sym}-NSE`;
    };
    
    const indexKey = getIndexKey(symbol);
    subscribeToSymbol(indexKey);

    strikes.forEach((strike) => {
      const data = optionsData[expiry][strike];
      if (data.CE) tokensToSub.push({ ...data.CE, exchange: data.CE.exch_seg, name: symbol });
      if (data.PE) tokensToSub.push({ ...data.PE, exchange: data.PE.exch_seg, name: symbol });
    });

    subscribeToOptionBatch(tokensToSub);

    setHasScrolled(false); // Reset scroll on expiry change

    return () => {
      unsubscribeFromOptionBatch(tokensToSub);
      unsubscribeFromSymbol(indexKey);
    };
  }, [expiry, optionsData, symbol, subscribeToOptionBatch, unsubscribeFromOptionBatch, subscribeToSymbol, unsubscribeFromSymbol]);

  const getIndexKey = (sym) => {
    if (sym === 'SENSEX' || sym === 'BANKEX') return `${sym}-BSE`;
    if (sym === 'CRUDEOIL' || sym === 'GOLD' || sym === 'SILVER' || sym === 'NATURALGAS') return `${sym}-MCX`;
    return `${sym}-NSE`;
  };
  
  const indexKey = getIndexKey(symbol);
  const spotPriceData = prices[indexKey] || {};
  const spotPrice = spotPriceData.ltp || 0;
  const spotPct = spotPriceData.pct || 0;
  const chain = optionsData[expiry] || {};
  const strikes = Object.keys(chain).map(Number).sort((a, b) => a - b);

  // Auto-scroll to ATM strike when data is available
  useEffect(() => {
    if (!hasScrolled && atmRowRef.current && spotPrice > 0) {
      atmRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHasScrolled(true);
    }
  }, [spotPrice, hasScrolled, strikes]);

  const handleTrade = (opt, type) => {
    if (!opt) return;
    openOrderModal(opt.symbol, type === 'BUY' ? 'BUY' : 'SELL', opt.lotsize ? parseInt(opt.lotsize) : 1);
  };

  if (loading) {
    return <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Option Chain...</div>;
  }
  
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
  if (spotPrice > 0 && strikes.length > 0) {
    atmStrike = strikes.reduce((prev, curr) => 
      Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
    );
  }

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

        {/* Section 3: Fut Price */}
        <div className="top-bar-section">
          <span className="top-bar-label">Fut Price</span>
          <span className="top-bar-value">-</span>
        </div>

        <div className="top-bar-divider"></div>

        {/* Section 4: INDIAVIX */}
        <div className="top-bar-section">
          <span className="top-bar-label">INDIAVIX</span>
          <span className="top-bar-value">-</span>
          <span className="top-bar-pct positive"></span>
        </div>

        <div className="top-bar-divider"></div>

        {/* Section 5: IVP */}
        <div className="top-bar-section">
          <span className="top-bar-label">IVP</span>
          <span className="top-bar-value">-</span>
        </div>

        <div className="top-bar-divider"></div>

        {/* Section 6: Toggle */}
        <div className="top-bar-section">
          <label className="toggle-switch">
            <input type="checkbox" />
            <span className="slider round"></span>
          </label>
          <span className="top-bar-label">Per Lot</span>
        </div>
      </div>

      {/* Table */}
      <div className="option-chain-table-container">
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
            {strikes.map((strike) => {
              const call = chain[strike].CE;
              const put = chain[strike].PE;

              const callPriceData = call ? prices[call.symbol] : null;
              const putPriceData = put ? prices[put.symbol] : null;

              const cLtp = callPriceData?.ltp || 0;
              const pLtp = putPriceData?.ltp || 0;

              // Calculate IV
              let cIV = (cLtp > 0 && spotPrice > 0) ? calculateIV('CE', cLtp, spotPrice, strike, T, r) : 0;
              let pIV = (pLtp > 0 && spotPrice > 0) ? calculateIV('PE', pLtp, spotPrice, strike, T, r) : 0;

              // Put-Call Parity Fallback: Deep ITM options often violate strict Spot intrinsic bounds due to Futures pricing.
              // We mirror the IV from the OTM side (which is always valid) for the same strike.
              if (cIV === 0 && pIV > 0) cIV = pIV;
              if (pIV === 0 && cIV > 0) pIV = cIV;

              // Calculate Greeks
              const cGreeks = (cIV > 0) ? calculateGreeks('CE', spotPrice, strike, T, r, cIV) : { delta: 0, theta: 0, vega: 0 };
              const pGreeks = (pIV > 0) ? calculateGreeks('PE', spotPrice, strike, T, r, pIV) : { delta: 0, theta: 0, vega: 0 };

              const isCallITM = spotPrice > 0 && strike < spotPrice;
              const isPutITM = spotPrice > 0 && strike > spotPrice;

              const cBreakeven = cLtp > 0 ? strike + cLtp : 0;
              const pBreakeven = pLtp > 0 ? strike - pLtp : 0;
              
              const cBreakPct = (cBreakeven > 0 && spotPrice > 0) ? ((cBreakeven / spotPrice) - 1) * 100 : 0;
              const pBreakPct = (pBreakeven > 0 && spotPrice > 0) ? ((pBreakeven / spotPrice) - 1) * 100 : 0;

              return (
                <tr key={strike} ref={strike === atmStrike ? atmRowRef : null}>
                  {/* Calls */}
                  <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`} style={{ color: 'var(--text-secondary)' }}>{cIV > 0 ? cGreeks.delta.toFixed(2) : '-'}</td>
                  <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`} style={{ color: 'var(--text-secondary)' }}>{cIV > 0 ? cGreeks.theta.toFixed(2) : '-'}</td>
                  <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`} style={{ color: 'var(--text-secondary)' }}>{cIV > 0 ? cGreeks.vega.toFixed(2) : '-'}</td>
                  <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`} style={{ color: 'var(--color-yellow)' }}>{cIV > 0 ? (cIV * 100).toFixed(1) + '%' : '-'}</td>
                  <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`}>{callPriceData?.volume || '-'}</td>
                  <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`} style={{ color: callPriceData?.change >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                    {callPriceData?.change ? (
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.3' }}>
                        <span style={{ fontSize: '11px' }}>{callPriceData.change > 0 ? '+' : ''}{callPriceData.change.toFixed(2)}</span>
                        <span style={{ fontSize: '10px', opacity: 0.8 }}>
                          ({callPriceData.pct > 0 ? '+' : ''}{callPriceData.pct?.toFixed(1) || '0.0'}%)
                        </span>
                      </div>
                    ) : '-'}
                  </td>
                  <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`}>
                    <div className="ltp-container">
                      <span className="ltp-value" style={{ fontWeight: '600', color: callPriceData?.change >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                        {cLtp > 0 ? cLtp.toFixed(2) : '-'}
                      </span>
                      <div className="action-buttons">
                        <button onClick={() => handleTrade(call, 'BUY')} className="btn-mini buy">B</button>
                        <button onClick={() => handleTrade(call, 'SELL')} className="btn-mini sell">S</button>
                      </div>
                    </div>
                  </td>
                  <td className={`center border-right ${isCallITM ? 'bg-itm-call' : ''}`}>
                    {cBreakeven > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.3' }}>
                        <span style={{ fontSize: '11px', color: '#E2E8F0' }}>{cBreakeven.toFixed(1)}</span>
                        <span style={{ fontSize: '10px', color: cBreakPct >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                          {cBreakPct > 0 ? '+' : ''}{cBreakPct.toFixed(1)}%
                        </span>
                      </div>
                    ) : '-'}
                  </td>

                  {/* Strike */}
                  <td className="strike-cell">{strike}</td>

                  {/* Puts */}
                  <td className={`center border-left ${isPutITM ? 'bg-itm-put' : ''}`}>
                    {pBreakeven > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.3' }}>
                        <span style={{ fontSize: '11px', color: '#E2E8F0' }}>{pBreakeven.toFixed(1)}</span>
                        <span style={{ fontSize: '10px', color: pBreakPct >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                          {pBreakPct > 0 ? '+' : ''}{pBreakPct.toFixed(1)}%
                        </span>
                      </div>
                    ) : '-'}
                  </td>
                  <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`}>
                    <div className="ltp-container">
                      <span className="ltp-value" style={{ fontWeight: '600', color: putPriceData?.change >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                        {pLtp > 0 ? pLtp.toFixed(2) : '-'}
                      </span>
                      <div className="action-buttons">
                        <button onClick={() => handleTrade(put, 'BUY')} className="btn-mini buy">B</button>
                        <button onClick={() => handleTrade(put, 'SELL')} className="btn-mini sell">S</button>
                      </div>
                    </div>
                  </td>
                  <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`} style={{ color: putPriceData?.change >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                    {putPriceData?.change ? (
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.3' }}>
                        <span style={{ fontSize: '11px' }}>{putPriceData.change > 0 ? '+' : ''}{putPriceData.change.toFixed(2)}</span>
                        <span style={{ fontSize: '10px', opacity: 0.8 }}>
                          ({putPriceData.pct > 0 ? '+' : ''}{putPriceData.pct?.toFixed(1) || '0.0'}%)
                        </span>
                      </div>
                    ) : '-'}
                  </td>
                  <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`}>{putPriceData?.volume || '-'}</td>
                  <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`} style={{ color: 'var(--color-yellow)' }}>{pIV > 0 ? (pIV * 100).toFixed(1) + '%' : '-'}</td>
                  <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`} style={{ color: 'var(--text-secondary)' }}>{pIV > 0 ? pGreeks.vega.toFixed(2) : '-'}</td>
                  <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`} style={{ color: 'var(--text-secondary)' }}>{pIV > 0 ? pGreeks.theta.toFixed(2) : '-'}</td>
                  <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`} style={{ color: 'var(--text-secondary)' }}>{pIV > 0 ? pGreeks.delta.toFixed(2) : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OptionChainView;
