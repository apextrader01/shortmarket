const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/StockDetails.jsx', 'utf8');

const renderTechReplacement = `
  const renderTechnicals = () => {
    if (!technicals) return <div style={{ padding: '20px', color: '#94A3B8' }}>Not enough historical data to compute technicals. Please select a longer timeframe chart.</div>;

    const { rsi, macd, sma10, sma20, sma50, sma100, sma200, ema10, ema20, ema50, ema200, bb, stoch, adx, atr } = technicals;
    const ltp = price?.ltp || 0;

    const renderInd = (label, val, verdict) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '8px' }}>
        <span style={{ color: '#94A3B8', fontSize: '13px' }}>{label}</span>
        <div style={{ display: 'flex', gap: '16px', width: '150px', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: '700', fontSize: '13px' }}>{val}</span>
          <span style={{ 
            fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
            background: verdict === 'BULLISH' ? 'rgba(34,197,94,0.15)' : (verdict === 'BEARISH' ? 'rgba(239,83,80,0.15)' : 'var(--border-color)'),
            color: verdict === 'BULLISH' ? '#22C55E' : (verdict === 'BEARISH' ? '#EF5350' : '#94A3B8')
          }}>{verdict}</span>
        </div>
      </div>
    );

    return (
      <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Oscillators & Momentum</h4>
          <div className="glass-panel" style={{ padding: '16px' }}>
            {renderInd('RSI (14)', rsi?.toFixed(2), rsi > 70 ? 'BEARISH' : (rsi < 30 ? 'BULLISH' : 'NEUTRAL'))}
            {renderInd('MACD (12, 26)', macd?.MACD?.toFixed(2), macd?.MACD > macd?.signal ? 'BULLISH' : 'BEARISH')}
            {stoch && renderInd('Stochastic (14, 3)', stoch.k?.toFixed(2), stoch.k > 80 ? 'BEARISH' : (stoch.k < 20 ? 'BULLISH' : 'NEUTRAL'))}
            {adx && renderInd('ADX (14)', adx?.adx?.toFixed(2), adx.adx > 25 ? (adx.pdi > adx.mdi ? 'BULLISH' : 'BEARISH') : 'NEUTRAL')}
            {atr && renderInd('ATR (14) Volatility', atr?.toFixed(2), 'NEUTRAL')}
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Bollinger Bands (20, 2)</h4>
          <div className="glass-panel" style={{ padding: '16px' }}>
            {bb && renderInd('Upper Band (Overbought)', bb.upper?.toFixed(2), ltp > bb.upper ? 'BEARISH' : 'NEUTRAL')}
            {bb && renderInd('Middle Band (SMA 20)', bb.middle?.toFixed(2), ltp > bb.middle ? 'BULLISH' : 'BEARISH')}
            {bb && renderInd('Lower Band (Oversold)', bb.lower?.toFixed(2), ltp < bb.lower ? 'BULLISH' : 'NEUTRAL')}
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Exponential Moving Averages (EMA)</h4>
          <div className="glass-panel" style={{ padding: '16px' }}>
            {ema10 && renderInd('EMA 10', '\\u20B9' + ema10?.toFixed(2), ltp > ema10 ? 'BULLISH' : 'BEARISH')}
            {ema20 && renderInd('EMA 20', '\\u20B9' + ema20?.toFixed(2), ltp > ema20 ? 'BULLISH' : 'BEARISH')}
            {ema50 && renderInd('EMA 50', '\\u20B9' + ema50?.toFixed(2), ltp > ema50 ? 'BULLISH' : 'BEARISH')}
            {ema200 && renderInd('EMA 200', '\\u20B9' + ema200?.toFixed(2), ltp > ema200 ? 'BULLISH' : 'BEARISH')}
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Simple Moving Averages (SMA)</h4>
          <div className="glass-panel" style={{ padding: '16px' }}>
            {sma10 && renderInd('SMA 10', '\\u20B9' + sma10?.toFixed(2), ltp > sma10 ? 'BULLISH' : 'BEARISH')}
            {sma20 && renderInd('SMA 20', '\\u20B9' + sma20?.toFixed(2), ltp > sma20 ? 'BULLISH' : 'BEARISH')}
            {sma50 && renderInd('SMA 50', '\\u20B9' + sma50?.toFixed(2), ltp > sma50 ? 'BULLISH' : 'BEARISH')}
            {sma100 && renderInd('SMA 100', '\\u20B9' + sma100?.toFixed(2), ltp > sma100 ? 'BULLISH' : 'BEARISH')}
            {sma200 && renderInd('SMA 200', '\\u20B9' + sma200?.toFixed(2), ltp > sma200 ? 'BULLISH' : 'BEARISH')}
          </div>
        </div>
      </div>
    );
  };
`;

const startIndex = code.indexOf('const renderTechnicals = () => {');
const endIndex = code.indexOf('const renderNews = () => {');
code = code.substring(0, startIndex) + renderTechReplacement + code.substring(endIndex);

fs.writeFileSync('frontend/src/components/StockDetails.jsx', code, 'utf8');
console.log('Patched new indicators UI');
