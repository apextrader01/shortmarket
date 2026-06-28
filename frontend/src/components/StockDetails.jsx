import React, { useEffect, useState } from 'react';
import { SMA, RSI, MACD } from 'technicalindicators';

export default function StockDetails({ symbol, price, candles }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    fetch(`/api/stocks/${encodeURIComponent(symbol)}/details`)
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

    technicals = { rsi: currentRSI, macd: currentMACD, sma10, sma20, sma50, sma100, sma200 };
  }

  const tabStyle = (tab) => ({
    padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
    color: activeTab === tab ? '#60A5FA' : '#94A3B8',
    borderBottom: activeTab === tab ? '2px solid #60A5FA' : '2px solid transparent',
    transition: 'all 0.2s'
  });

  const renderOverview = () => {
    if (loading) return <div style={{ padding: '20px', color: '#94A3B8' }}>Loading detailed data...</div>;
    if (!details) return <div style={{ padding: '20px', color: '#94A3B8' }}>Details not available for this stock.</div>;
    if (details.error) return <div style={{ padding: '20px', color: '#EF5350' }}>Error: {details.error} - {details.details}</div>;

    const stats = details.stats || {};
    const header = details.header || {};
    const profile = details.details || {};
    const holders = details.shareHoldingPattern || {};
    const fundsInvested = details.fundsInvested || [];
    const similarAssets = details.similarAssets?.peerList || [];
    const financials = details.financialStatement || [];
    
    // Fallbacks if price is missing from AngelOne
    const livePrice = price?.ltp || details.priceData?.ltp || 0;
    
    // Get latest daily candle for today's high/low and volume
    const latestCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
    const l = price?.low || latestCandle?.low || 0;
    const h = price?.high || latestCandle?.high || 0;
    const vol = price?.volume || latestCandle?.volume || details.header?.floatingShares || 0;
    
    // 52 Week High/Low from Groww
    const nsePrice = details.priceData?.nse || {};
    const bsePrice = details.priceData?.bse || {};
    const low52 = nsePrice.yearLowPrice || bsePrice.yearLowPrice || 0;
    const high52 = nsePrice.yearHighPrice || bsePrice.yearHighPrice || 0;
    
    // Circuit limits
    const lowerCircuit = details.livePriceData?.lowPriceRange;
    const upperCircuit = details.livePriceData?.highPriceRange;

    const formatNum = (num) => num ? (num >= 1e7 ? (num / 1e7).toFixed(2) + ' Cr' : num.toLocaleString('en-IN')) : '-';
    
    return (
      <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Performance */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '24px' }}>Performance</h4>
          
          {/* Range Slider 1 */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
              <span>Today's low</span>
              <span>Today's high</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>
              <span>{l ? l.toFixed(2) : '-'}</span>
              <span>{h ? h.toFixed(2) : '-'}</span>
            </div>
            <div style={{ position: 'relative', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
              {livePrice > 0 && h > l && (
                <div style={{ position: 'absolute', left: `${Math.max(0, Math.min(100, ((livePrice - l) / (h - l)) * 100))}%`, top: '4px', transform: 'translateX(-50%)' }}>
                  <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '8px solid #64748B' }} />
                </div>
              )}
            </div>
          </div>

          {/* Range Slider 2 */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
              <span>52 week low</span>
              <span>52 week high</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>
              <span>{low52 ? low52.toFixed(2) : '-'}</span>
              <span>{high52 ? high52.toFixed(2) : '-'}</span>
            </div>
            <div style={{ position: 'relative', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
              {livePrice > 0 && high52 > low52 && (
                <div style={{ position: 'absolute', left: `${Math.max(0, Math.min(100, ((livePrice - low52) / (high52 - low52)) * 100))}%`, top: '4px', transform: 'translateX(-50%)' }}>
                  <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '8px solid #64748B' }} />
                </div>
              )}
            </div>
          </div>

          {/* Bottom row metrics */}
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>Open price</span>
              <span style={{ fontSize: '14px', fontWeight: '700' }}>{price?.open ? price.open.toFixed(2) : '-'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>Previous close</span>
              <span style={{ fontSize: '14px', fontWeight: '700' }}>{price?.close ? price.close.toFixed(2) : '-'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>Live volume</span>
              <span style={{ fontSize: '14px', fontWeight: '700' }}>{formatNum(vol)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>Lower circuit</span>
              <span style={{ fontSize: '14px', fontWeight: '700' }}>{lowerCircuit ? lowerCircuit.toFixed(2) : '-'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>Upper circuit</span>
              <span style={{ fontSize: '14px', fontWeight: '700' }}>{upperCircuit ? upperCircuit.toFixed(2) : '-'}</span>
            </div>
          </div>
        </div>

        {/* Fundamentals */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Fundamentals</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
            {[
              ['Market Cap', formatNum(stats.marketCap)],
              ['P/E Ratio (TTM)', stats.peRatio?.toFixed(2) || '-'],
              ['P/B Ratio', stats.pbRatio?.toFixed(2) || '-'],
              ['Industry P/E', stats.industryPe?.toFixed(2) || '-'],
              ['Debt to Equity', stats.debtToEquity?.toFixed(2) || '-'],
              ['ROE', stats.roe ? stats.roe.toFixed(2) + '%' : '-'],
              ['EPS (TTM)', stats.epsTtm?.toFixed(2) || '-'],
              ['Dividend Yield', stats.divYield ? stats.divYield.toFixed(2) + '%' : '-'],
              ['Book Value', stats.bookValue?.toFixed(2) || '-'],
              ['Face Value', stats.faceValue || '-'],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>{lbl}</span>
                <span style={{ fontWeight: '600', fontSize: '13px' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* About Company */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '8px' }}>About Company</h4>
          <p style={{ fontSize: '12px', color: '#CBD5E1', lineHeight: '1.6', marginBottom: '16px', opacity: 0.9 }}>
            {profile.businessSummary ? profile.businessSummary.substring(0, 300) + '...' : 'No description available.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="glass-panel" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>MD/CEO</div>
              <div style={{ fontSize: '12px', fontWeight: '700' }}>{profile.managingDirector || profile.ceo || '-'}</div>
            </div>
            <div className="glass-panel" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>Founded</div>
              <div style={{ fontSize: '12px', fontWeight: '700' }}>{profile.foundedYear || '-'}</div>
            </div>
            <div className="glass-panel" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>Symbol</div>
              <div style={{ fontSize: '12px', fontWeight: '700' }}>{header.nseScriptCode || header.bseScriptCode || '-'}</div>
            </div>
            <div className="glass-panel" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>Industry</div>
              <div style={{ fontSize: '12px', fontWeight: '700' }}>{header.industryName || '-'}</div>
            </div>
          </div>
        </div>

        {/* Shareholding Pattern */}
        {holders && holders.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Shareholding Pattern</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {holders[0].shareHoldings.map((h) => (
                <div key={h.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>{h.key}</span>
                    <span style={{ fontWeight: '700' }}>{(h.value).toFixed(2)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                    <div style={{ width: `${h.value}%`, height: '100%', background: '#60A5FA', borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Financial Performance */}
        {financials.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Financial Performance (Yearly)</h4>
            <div style={{ display: 'grid', gap: '16px' }}>
              {financials.map(fin => (
                <div key={fin.title} className="glass-panel" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: '#E2E8F0' }}>{fin.title}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>Year</span>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>Value (Cr)</span>
                  </div>
                  {fin.yearly && Object.entries(fin.yearly).slice(-5).map(([year, val]) => (
                    <div key={year} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600' }}>{year}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: fin.title === 'Profit' && val < 0 ? '#EF4444' : '#10B981' }}>₹{val?.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
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
            <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Mutual Funds Invested</h4>
            <div style={{ display: 'grid', gap: '12px' }}>
              {fundsInvested.map(fund => (
                <div key={fund.searchId} className="glass-panel hoverable" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s' }}>
                  {fund.logoUrl && <img src={fund.logoUrl} alt="logo" style={{ width: '28px', height: '28px', borderRadius: '4px', background: '#FFF' }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{fund.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>AUM %</div>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{fund.investedAumPercent?.toFixed(2)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Similar Stocks */}
        {similarAssets.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Similar Stocks</h4>
            <div className="glass-panel" style={{ overflowX: 'auto', padding: '0' }}>
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#94A3B8', fontSize: '12px' }}>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '400' }}>Stock</th>
                    <th style={{ padding: '16px', fontWeight: '400' }}>Mkt price (1D)</th>
                    <th style={{ padding: '16px', fontWeight: '400', width: '150px', textAlign: 'center' }}>52 week performance</th>
                    <th style={{ padding: '16px', fontWeight: '400' }}>Market cap (Cr)</th>
                    <th style={{ padding: '16px', fontWeight: '400' }}>P/E ratio</th>
                    <th style={{ padding: '16px', fontWeight: '400' }}>P/B ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {similarAssets.map(peer => {
                    // For the slider, since we don't have LTP in this payload, we just render the bounds
                    // If we had LTP, we'd calculate the dot position. We'll put it in the middle for now or omit the dot.
                    return (
                      <tr key={peer.companyHeader?.searchId} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.2s' }} className="hoverable-row">
                        <td style={{ padding: '16px', textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {peer.companyHeader?.logoUrl && <img src={peer.companyHeader.logoUrl} alt="logo" style={{ width: '28px', height: '28px', borderRadius: '4px', background: '#FFF' }} />}
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#E2E8F0' }}>{peer.companyHeader?.displayName}</div>
                              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{peer.companyHeader?.nseScriptCode || peer.companyHeader?.bseScriptCode}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px', fontSize: '13px', fontWeight: '600' }}>
                          {peer.livePriceData?.ltp ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>₹{peer.livePriceData.ltp.toFixed(2)}</span>
                              <span style={{ fontSize: '11px', color: peer.livePriceData.dayChange < 0 ? '#EF4444' : '#10B981' }}>
                                {peer.livePriceData.dayChange > 0 ? '+' : ''}{peer.livePriceData.dayChange.toFixed(2)} ({peer.livePriceData.dayChangePerc.toFixed(2)}%)
                              </span>
                            </div>
                          ) : '-'}
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#94A3B8' }}>L</span>
                            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', position: 'relative' }}>
                                {peer.livePriceData?.ltp && peer.nseYearHigh > peer.nseYearLow && (
                                    <div style={{ 
                                      position: 'absolute', 
                                      left: `${Math.max(0, Math.min(100, ((peer.livePriceData.ltp - peer.nseYearLow) / (peer.nseYearHigh - peer.nseYearLow)) * 100))}%`, 
                                      top: '50%', transform: 'translate(-50%, -50%)', 
                                      width: '4px', height: '10px', background: '#94A3B8', borderRadius: '2px' 
                                    }} />
                                )}
                            </div>
                            <span style={{ fontSize: '10px', color: '#94A3B8' }}>H</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px', fontSize: '13px', fontWeight: '600' }}>
                          {formatNum(peer.marketCap)}
                        </td>
                        <td style={{ padding: '16px', fontSize: '13px', fontWeight: '600' }}>
                          {peer.peRatio ? peer.peRatio.toFixed(2) : '-'}
                        </td>
                        <td style={{ padding: '16px', fontSize: '13px', fontWeight: '600' }}>
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
    if (!technicals) return <div style={{ padding: '20px', color: '#94A3B8' }}>Not enough historical data to compute technicals. Please select a longer timeframe chart.</div>;

    const { rsi, macd, sma10, sma20, sma50, sma100, sma200 } = technicals;
    const ltp = price?.ltp || 0;

    const renderInd = (label, val, verdict) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '8px' }}>
        <span style={{ color: '#94A3B8', fontSize: '13px' }}>{label}</span>
        <div style={{ display: 'flex', gap: '16px', width: '150px', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: '700', fontSize: '13px' }}>{val}</span>
          <span style={{ 
            fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
            background: verdict === 'BULLISH' ? 'rgba(34,197,94,0.15)' : (verdict === 'BEARISH' ? 'rgba(239,83,80,0.15)' : 'rgba(255,255,255,0.1)'),
            color: verdict === 'BULLISH' ? '#22C55E' : (verdict === 'BEARISH' ? '#EF5350' : '#94A3B8')
          }}>{verdict}</span>
        </div>
      </div>
    );

    return (
      <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Indicators</h4>
          <div className="glass-panel" style={{ padding: '16px' }}>
            {renderInd('RSI (14)', rsi?.toFixed(2), rsi > 70 ? 'BEARISH' : (rsi < 30 ? 'BULLISH' : 'NEUTRAL'))}
            {renderInd('MACD (12, 26)', macd?.MACD?.toFixed(2), macd?.MACD > macd?.signal ? 'BULLISH' : 'BEARISH')}
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Moving Averages (SMA)</h4>
          <div className="glass-panel" style={{ padding: '16px' }}>
            {sma10 && renderInd('SMA 10', `₹${sma10.toFixed(2)}`, ltp > sma10 ? 'BULLISH' : 'BEARISH')}
            {sma20 && renderInd('SMA 20', `₹${sma20.toFixed(2)}`, ltp > sma20 ? 'BULLISH' : 'BEARISH')}
            {sma50 && renderInd('SMA 50', `₹${sma50.toFixed(2)}`, ltp > sma50 ? 'BULLISH' : 'BEARISH')}
            {sma100 && renderInd('SMA 100', `₹${sma100.toFixed(2)}`, ltp > sma100 ? 'BULLISH' : 'BEARISH')}
            {sma200 && renderInd('SMA 200', `₹${sma200.toFixed(2)}`, ltp > sma200 ? 'BULLISH' : 'BEARISH')}
          </div>
        </div>
      </div>
    );
  };

  const renderNews = () => {
    if (loading) return <div style={{ padding: '20px', color: '#94A3B8' }}>Loading news...</div>;
    const news = details?.news || [];
    if (news.length === 0) return <div style={{ padding: '20px', color: '#94A3B8' }}>No recent news found.</div>;

    return (
      <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {news.map((item, i) => (
          <a key={i} href={item.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <div className="glass-panel hoverable" style={{ padding: '16px', transition: 'all 0.2s', cursor: 'pointer' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '6px' }}>
                {item.publisher} • {new Date(item.providerPublishTime * 1000).toLocaleDateString()}
              </div>
              <h5 style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC', marginBottom: '8px', lineHeight: '1.4' }}>
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
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', overflowX: 'auto', paddingBottom: '4px' }}>
        <div onClick={() => setActiveTab('Overview')} style={tabStyle('Overview')}>Overview</div>
        <div onClick={() => setActiveTab('Technicals')} style={tabStyle('Technicals')}>Technicals</div>
        <div onClick={() => setActiveTab('News')} style={tabStyle('News')}>News</div>
      </div>
      
      <div>
        {activeTab === 'Overview' && renderOverview()}
        {activeTab === 'Technicals' && renderTechnicals()}
        {activeTab === 'News' && renderNews()}
      </div>
    </div>
  );
}
