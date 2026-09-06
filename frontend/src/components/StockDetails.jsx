import React, { useEffect, useState } from 'react';
import { useStore, API } from '../store';
import { SMA, RSI, MACD, EMA, BollingerBands, Stochastic, ADX, ATR } from 'technicalindicators';

export default function StockDetails({ symbol, price, candles }) {
  const cleanSym = (symbol ? String(symbol).replace(/^(NSE|BSE|MCX):/i, '').split('-')[0] : '') || 'Stock';
  const [activeTab, setActiveTab] = useState('Overview');
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    fetch(`${API}/api/stocks/${encodeURIComponent(symbol)}/details`)
      .then(r => r.json())
      .then(data => {
        setDetails(data);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, [symbol]);

  // Calculate Technicals
  let technicals = null;
  if (candles && candles.length > 50) {
    
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    
    // Latest RSI (14)
    const rsiArr = RSI.calculate({ values: closes, period: 14 });
    const currentRSI = rsiArr[rsiArr.length - 1];

    // Latest MACD (12, 26, 9)
    const macdArr = MACD.calculate({ 
      values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false 
    });
    const currentMACD = macdArr[macdArr.length - 1];

    // SMAs
    const sma10 = SMA.calculate({ values: closes, period: 10 }).pop();
    const sma20 = SMA.calculate({ values: closes, period: 20 }).pop();
    const sma50 = SMA.calculate({ values: closes, period: 50 }).pop();
    const sma100 = closes.length > 100 ? SMA.calculate({ values: closes, period: 100 }).pop() : null;
    const sma200 = closes.length > 200 ? SMA.calculate({ values: closes, period: 200 }).pop() : null;

    // EMAs
    const ema10 = EMA.calculate({ values: closes, period: 10 }).pop();
    const ema20 = EMA.calculate({ values: closes, period: 20 }).pop();
    const ema50 = EMA.calculate({ values: closes, period: 50 }).pop();
    const ema200 = closes.length > 200 ? EMA.calculate({ values: closes, period: 200 }).pop() : null;

    // Others
    const bb = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 }).pop();
    const stoch = Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 }).pop();
    const adx = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 }).pop();
    const atr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 }).pop();

    technicals = { 
      rsi: currentRSI, macd: currentMACD, 
      sma10, sma20, sma50, sma100, sma200,
      ema10, ema20, ema50, ema200,
      bb, stoch, adx, atr 
    };

  }

  const tabStyle = (tab) => ({
    padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
    color: activeTab === tab ? 'var(--color-blue)' : 'var(--text-secondary)',
    borderBottom: activeTab === tab ? '2px solid var(--color-blue)' : '2px solid transparent',
    transition: 'all 0.2s'
  });

  const renderOverview = () => {
    if (loading) return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Loading detailed data...</div>;
    if (!details) return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Details not available for this stock.</div>;
    if (details.error) return <div style={{ padding: '20px', color: 'var(--color-red-light)' }}>Error: {details.error} - {details.details}</div>;

    const stats = details.stats || {};
    const header = details.header || {};
    const profile = details.details || {};
    const holders = details.shareHoldingPattern || {};
    const fundsInvested = details.fundsInvested || [];
    const similarAssets = details.similarAssets?.peerList || [];
    const financials = details.financialStatement || [];
    
    // Fallbacks if price is missing
    const livePrice = price?.ltp || details.priceData?.ltp || 0;
    
    // Get latest daily candle for today's high/low and volume
    const latestCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
    const l = price?.low || latestCandle?.low || 0;
    const h = price?.high || latestCandle?.high || 0;
    const vol = price?.volume || latestCandle?.volume || details.header?.floatingShares || 0;
    
    // 52 Week High/Low from Groww
    const nsePrice = details.priceData?.nse || {};
    const bsePrice = details.priceData?.bse || {};
    const low52 = stats.low52 || stats.yearLowPrice || nsePrice.yearLowPrice || bsePrice.yearLowPrice || (price?.low ? price.low * 0.85 : 0);
    const high52 = stats.high52 || stats.yearHighPrice || nsePrice.yearHighPrice || bsePrice.yearHighPrice || (price?.high ? price.high * 1.15 : 0);
    
    // Circuit limits
    const lowerCircuit = details.livePriceData?.lowPriceRange || nsePrice.lowerCircuit || (livePrice > 0 ? (livePrice * 0.9) : 0);
    const upperCircuit = details.livePriceData?.highPriceRange || nsePrice.upperCircuit || (livePrice > 0 ? (livePrice * 1.1) : 0);

    const formatNum = (num) => num ? (num >= 1e7 ? (num / 1e7).toFixed(2) + ' Cr' : num.toLocaleString('en-IN')) : '-';
    
    return (
      <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
        
        {/* Performance */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '24px', color: 'var(--text-primary)' }}>Performance</h4>
          
          {/* Range Slider 1 */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>Today's low</span>
              <span>Today's high</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
              <span>{l ? l.toFixed(2) : '-'}</span>
              <span>{h ? h.toFixed(2) : '-'}</span>
            </div>
            <div style={{ position: 'relative', height: '4px', background: 'var(--border-color)', borderRadius: '2px' }}>
              {livePrice > 0 && h > l && (
                <div style={{ position: 'absolute', left: `${Math.max(0, Math.min(100, ((livePrice - l) / (h - l)) * 100))}%`, top: '4px', transform: 'translateX(-50%)' }}>
                  <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '8px solid var(--text-secondary)' }} />
                </div>
              )}
            </div>
          </div>

          {/* Range Slider 2 */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>52 week low</span>
              <span>52 week high</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
              <span>{low52 ? low52.toFixed(2) : '-'}</span>
              <span>{high52 ? high52.toFixed(2) : '-'}</span>
            </div>
            <div style={{ position: 'relative', height: '4px', background: 'var(--border-color)', borderRadius: '2px' }}>
              {livePrice > 0 && high52 > low52 && (
                <div style={{ position: 'absolute', left: `${Math.max(0, Math.min(100, ((livePrice - low52) / (high52 - low52)) * 100))}%`, top: '4px', transform: 'translateX(-50%)' }}>
                  <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '8px solid var(--text-secondary)' }} />
                </div>
              )}
            </div>
          </div>

          {/* Bottom row metrics */}
          <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Open price</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{price?.open ? price.open.toFixed(2) : (details.livePriceData?.open ? Number(details.livePriceData.open).toFixed(2) : (price?.close ? price.close.toFixed(2) : '-'))}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Previous close</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{price?.close ? price.close.toFixed(2) : '-'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Live volume</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatNum(vol)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Lower circuit</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{lowerCircuit ? lowerCircuit.toFixed(2) : '-'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Upper circuit</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{upperCircuit ? upperCircuit.toFixed(2) : '-'}</span>
            </div>
          </div>
        </div>

        {/* Fundamentals */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>Fundamentals</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
            {(details.fundamentals || []).map((item) => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{item.name}</span>
                <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* About Company */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)' }}>About Company</h4>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
            {profile.businessSummary ? profile.businessSummary.substring(0, 400) + '...' : (profile.aboutCompany || `${header.companyName || cleanSym} is an actively traded enterprise listed on Indian stock exchanges.`)}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="glass-panel" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>MD/CEO</div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{profile.managingDirector || profile.ceo || profile.directors?.[0] || '-'}</div>
            </div>
            <div className="glass-panel" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Founded</div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{profile.foundedYear || '-'}</div>
            </div>
            <div className="glass-panel" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Symbol</div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{header.nseScriptCode || header.bseScriptCode || cleanSym || '-'}</div>
            </div>
            <div className="glass-panel" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Industry</div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{header.industryName || '-'}</div>
            </div>
          </div>
        </div>

        {/* Shareholding Pattern */}
        {holders && holders.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>Shareholding Pattern</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {holders[0].shareHoldings.map((h) => (
                <div key={h.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{h.key}</span>
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{(h.value).toFixed(2)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px' }}>
                    <div style={{ width: `${h.value}%`, height: '100%', background: 'var(--color-blue)', borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {financials.length > 0 && (
          <div style={{ marginTop: '16px', minWidth: 0 }}>
            <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>Financial Performance (Yearly)</h4>
            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch', minWidth: 0, width: '100%' }} className="scrollbar-hide">
              {financials.map(fin => (
                <div key={fin.title} className="glass-panel" style={{ padding: '12px', minWidth: '240px', flexShrink: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>{fin.title}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Year</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Value (Cr)</span>
                  </div>
                  {fin.yearly && Object.entries(fin.yearly).slice(-5).map(([year, val]) => (
                    <div key={year} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{year}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: fin.title === 'Profit' && val < 0 ? 'var(--color-red-light)' : 'var(--color-green-light)' }}>₹{val?.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mutual Funds Invested */}
        {fundsInvested.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>Mutual Funds Invested</h4>
            <div style={{ display: 'grid', gap: '12px' }}>
              {fundsInvested.map(fund => (
                <div key={fund.searchId} className="glass-panel hoverable" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s' }}>
                  {fund.logoUrl && <img src={fund.logoUrl} alt="logo" style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'var(--bg-panel)' }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{fund.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>AUM %</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{fund.investedAumPercent?.toFixed(2)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Similar Stocks */}
        {similarAssets.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>Similar Stocks</h4>
            <div className="glass-panel" style={{ overflowX: 'auto', padding: '0' }}>
              <table className="responsive-mobile-table" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '12px', background: 'var(--bg-secondary)' }}>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600' }}>Stock</th>
                    <th style={{ padding: '14px 16px', fontWeight: '600' }}>Mkt price (1D)</th>
                    <th style={{ padding: '14px 16px', fontWeight: '600', width: '150px', textAlign: 'center' }}>52 week performance</th>
                    <th style={{ padding: '14px 16px', fontWeight: '600' }}>Market cap (Cr)</th>
                    <th style={{ padding: '14px 16px', fontWeight: '600' }}>P/E ratio</th>
                    <th style={{ padding: '14px 16px', fontWeight: '600' }}>P/B ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {similarAssets.map(peer => {
                    return (
                      <tr key={peer.companyHeader?.searchId} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="hoverable-row">
                        <td style={{ padding: '14px 16px', textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {peer.companyHeader?.logoUrl && <img src={peer.companyHeader.logoUrl} alt="logo" style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'var(--bg-panel)' }} />}
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{peer.companyHeader?.displayName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: '500' }}>{peer.companyHeader?.nseScriptCode || peer.companyHeader?.bseScriptCode}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {peer.livePriceData?.ltp ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: '700' }}>₹{peer.livePriceData.ltp.toFixed(2)}</span>
                              <span style={{ fontSize: '11px', color: peer.livePriceData.dayChange < 0 ? 'var(--color-red-light)' : 'var(--color-green-light)', fontWeight: '600' }}>
                                {peer.livePriceData.dayChange > 0 ? '+' : ''}{peer.livePriceData.dayChange.toFixed(2)} ({peer.livePriceData.dayChangePerc.toFixed(2)}%)
                              </span>
                            </div>
                          ) : '-'}
                        </td>
                        <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>L</span>
                            <div style={{ flex: 1, height: '4px', background: 'var(--border-color)', borderRadius: '2px', position: 'relative' }}>
                                {peer.livePriceData?.ltp && peer.nseYearHigh > peer.nseYearLow && (
                                    <div style={{ 
                                      position: 'absolute', 
                                      left: `${Math.max(0, Math.min(100, ((peer.livePriceData.ltp - peer.nseYearLow) / (peer.nseYearHigh - peer.nseYearLow)) * 100))}%`, 
                                      top: '50%', transform: 'translate(-50%, -50%)', 
                                      width: '4px', height: '10px', background: 'var(--color-blue)', borderRadius: '2px' 
                                    }} />
                                )}
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>H</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {formatNum(peer.marketCap)}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {peer.peRatio ? peer.peRatio.toFixed(2) : '-'}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {peer.pbRatio ? peer.pbRatio.toFixed(2) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    );
  };

  const renderTechnicals = () => {
    if (!technicals) return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Not enough historical data to compute technicals. Please select a longer timeframe chart.</div>;

    const { rsi, macd, sma10, sma20, sma50, sma100, sma200, ema10, ema20, ema50, ema200, bb, stoch, adx, atr } = technicals;
    const ltp = price?.ltp || 0;

    const renderInd = (label, val, verdict) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{label}</span>
        <div style={{ display: 'flex', gap: '16px', width: '150px', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>{val}</span>
          <span style={{ 
            fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
            background: verdict === 'BULLISH' ? 'rgba(34,197,94,0.15)' : (verdict === 'BEARISH' ? 'rgba(239,83,80,0.15)' : 'var(--border-color)'),
            color: verdict === 'BULLISH' ? 'var(--color-green-light)' : (verdict === 'BEARISH' ? 'var(--color-red-light)' : 'var(--text-secondary)')
          }}>{verdict}</span>
        </div>
      </div>
    );

    return (
      <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>Oscillators & Momentum</h4>
          <div className="glass-panel" style={{ padding: '16px' }}>
            {renderInd('RSI (14)', rsi?.toFixed(2), rsi > 70 ? 'BEARISH' : (rsi < 30 ? 'BULLISH' : 'NEUTRAL'))}
            {renderInd('MACD (12, 26)', macd?.MACD?.toFixed(2), macd?.MACD > macd?.signal ? 'BULLISH' : 'BEARISH')}
            {stoch && renderInd('Stochastic (14, 3)', stoch.k?.toFixed(2), stoch.k > 80 ? 'BEARISH' : (stoch.k < 20 ? 'BULLISH' : 'NEUTRAL'))}
            {adx && renderInd('ADX (14)', adx?.adx?.toFixed(2), adx.adx > 25 ? (adx.pdi > adx.mdi ? 'BULLISH' : 'BEARISH') : 'NEUTRAL')}
            {atr && renderInd('ATR (14) Volatility', atr?.toFixed(2), 'NEUTRAL')}
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>Bollinger Bands (20, 2)</h4>
          <div className="glass-panel" style={{ padding: '16px' }}>
            {bb && renderInd('Upper Band (Overbought)', bb.upper?.toFixed(2), ltp > bb.upper ? 'BEARISH' : 'NEUTRAL')}
            {bb && renderInd('Middle Band (SMA 20)', bb.middle?.toFixed(2), ltp > bb.middle ? 'BULLISH' : 'BEARISH')}
            {bb && renderInd('Lower Band (Oversold)', bb.lower?.toFixed(2), ltp < bb.lower ? 'BULLISH' : 'NEUTRAL')}
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>Exponential Moving Averages (EMA)</h4>
          <div className="glass-panel" style={{ padding: '16px' }}>
            {ema10 && renderInd('EMA 10', '₹' + ema10?.toFixed(2), ltp > ema10 ? 'BULLISH' : 'BEARISH')}
            {ema20 && renderInd('EMA 20', '₹' + ema20?.toFixed(2), ltp > ema20 ? 'BULLISH' : 'BEARISH')}
            {ema50 && renderInd('EMA 50', '₹' + ema50?.toFixed(2), ltp > ema50 ? 'BULLISH' : 'BEARISH')}
            {ema200 && renderInd('EMA 200', '₹' + ema200?.toFixed(2), ltp > ema200 ? 'BULLISH' : 'BEARISH')}
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>Simple Moving Averages (SMA)</h4>
          <div className="glass-panel" style={{ padding: '16px' }}>
            {sma10 && renderInd('SMA 10', '₹' + sma10?.toFixed(2), ltp > sma10 ? 'BULLISH' : 'BEARISH')}
            {sma20 && renderInd('SMA 20', '₹' + sma20?.toFixed(2), ltp > sma20 ? 'BULLISH' : 'BEARISH')}
            {sma50 && renderInd('SMA 50', '₹' + sma50?.toFixed(2), ltp > sma50 ? 'BULLISH' : 'BEARISH')}
            {sma100 && renderInd('SMA 100', '₹' + sma100?.toFixed(2), ltp > sma100 ? 'BULLISH' : 'BEARISH')}
            {sma200 && renderInd('SMA 200', '₹' + sma200?.toFixed(2), ltp > sma200 ? 'BULLISH' : 'BEARISH')}
          </div>
        </div>
      </div>
    );
  };

  const renderNews = () => {
    if (loading) return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Loading news...</div>;
    const news = details?.news || [];
    if (news.length === 0) return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>No recent news found.</div>;

    return (
      <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
        {news.map((item, i) => (
          <a key={i} href={item.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <div className="glass-panel hoverable" style={{ padding: '16px', transition: 'all 0.2s', cursor: 'pointer' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                {item.publisher} • {new Date(item.providerPublishTime * 1000).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <h5 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: '1.4' }}>
                {item.title}
              </h5>
            </div>
          </a>
        ))}
      </div>
    );
  };

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', paddingBottom: '4px' }}>
        <div onClick={() => setActiveTab('Overview')} style={tabStyle('Overview')}>Overview</div>
        <div onClick={() => setActiveTab('Technicals')} style={tabStyle('Technicals')}>Technicals</div>
        <div onClick={() => setActiveTab('News')} style={tabStyle('News')}>News</div>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', minWidth: 0, overflowX: 'hidden' }}>
        {activeTab === 'Overview' && renderOverview()}
        {activeTab === 'Technicals' && renderTechnicals()}
        {activeTab === 'News' && renderNews()}
      </div>
    </div>
  );
}


