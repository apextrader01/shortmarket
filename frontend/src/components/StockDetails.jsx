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
    
    // Fallbacks if price is missing from AngelOne
    const livePrice = price?.ltp || details.priceData?.ltp || 0;
    const l = price?.low || details.priceData?.low || 0;
    const h = price?.high || details.priceData?.high || 0;

    const formatNum = (num) => num ? (num >= 1e7 ? (num / 1e7).toFixed(2) + ' Cr' : num.toLocaleString('en-IN')) : '-';
    
    return (
      <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Performance */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Performance</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>Today's Low / High</div>
              <div style={{ fontSize: '14px', fontWeight: '700' }}>
                {l ? `₹${l.toFixed(2)}` : '-'} <span style={{color:'#64748B', fontWeight:'400'}}>—</span> {h ? `₹${h.toFixed(2)}` : '-'}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>52 Week Low / High</div>
              <div style={{ fontSize: '14px', fontWeight: '700' }}>
                {details.priceData?.low52w ? `₹${details.priceData.low52w.toFixed(2)}` : '-'} <span style={{color:'#64748B', fontWeight:'400'}}>—</span> {details.priceData?.high52w ? `₹${details.priceData.high52w.toFixed(2)}` : '-'}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>Open / Prev Close</div>
              <div style={{ fontSize: '14px', fontWeight: '700' }}>
                {price?.open ? `₹${price.open.toFixed(2)}` : '-'} / {price?.close ? `₹${price.close.toFixed(2)}` : '-'}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>Volume</div>
              <div style={{ fontSize: '14px', fontWeight: '700' }}>{formatNum(details.priceData?.volume || price?.volume)}</div>
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
