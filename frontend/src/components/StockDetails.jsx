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
    if (!details || details.error) return <div style={{ padding: '20px', color: '#94A3B8' }}>Details not available for this stock.</div>;

    const summary = details.summaryDetail || {};
    const keyStats = details.defaultKeyStatistics || {};
    const profile = details.assetProfile || {};
    const holders = details.majorHoldersBreakdown || {};

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
                {price?.low ? `₹${price.low.toFixed(2)}` : '-'} <span style={{color:'#64748B', fontWeight:'400'}}>—</span> {price?.high ? `₹${price.high.toFixed(2)}` : '-'}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>52 Week Low / High</div>
              <div style={{ fontSize: '14px', fontWeight: '700' }}>
                {summary.fiftyTwoWeekLow ? `₹${summary.fiftyTwoWeekLow.toFixed(2)}` : '-'} <span style={{color:'#64748B', fontWeight:'400'}}>—</span> {summary.fiftyTwoWeekHigh ? `₹${summary.fiftyTwoWeekHigh.toFixed(2)}` : '-'}
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
              <div style={{ fontSize: '14px', fontWeight: '700' }}>{formatNum(summary.volume || price?.volume)}</div>
            </div>
          </div>
        </div>

        {/* Fundamentals */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Fundamentals</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
            {[
              ['Market Cap', formatNum(summary.marketCap)],
              ['P/E Ratio (TTM)', summary.trailingPE?.toFixed(2) || '-'],
              ['P/B Ratio', keyStats.priceToBook?.toFixed(2) || '-'],
              ['Industry P/E', '-'],
              ['ROE', details.financialData?.returnOnEquity ? (details.financialData.returnOnEquity * 100).toFixed(2) + '%' : '-'],
              ['EPS (TTM)', keyStats.trailingEps?.toFixed(2) || '-'],
              ['Dividend Yield', summary.dividendYield ? (summary.dividendYield * 100).toFixed(2) + '%' : '-'],
              ['Book Value', keyStats.bookValue?.toFixed(2) || '-'],
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
            {profile.longBusinessSummary ? profile.longBusinessSummary.substring(0, 300) + '...' : 'No description available.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="glass-panel" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>Sector</div>
              <div style={{ fontSize: '12px', fontWeight: '700' }}>{profile.sector || '-'}</div>
            </div>
            <div className="glass-panel" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>Industry</div>
              <div style={{ fontSize: '12px', fontWeight: '700' }}>{profile.industry || '-'}</div>
            </div>
          </div>
        </div>

        {/* Shareholding Pattern */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Shareholding Pattern</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              ['Insiders / Promoters', holders.insidersPercentHeld],
              ['Institutions', holders.institutionsPercentHeld],
            ].map(([lbl, val]) => val ? (
              <div key={lbl}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>{lbl}</span>
                  <span style={{ fontWeight: '700' }}>{(val * 100).toFixed(2)}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                  <div style={{ width: `${val * 100}%`, height: '100%', background: '#60A5FA', borderRadius: '3px' }} />
                </div>
              </div>
            ) : null)}
          </div>
        </div>

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
