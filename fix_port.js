const fs = require('fs');

let pv = fs.readFileSync('frontend/src/components/PortfolioView.jsx', 'utf8');

// The best way to fix PortfolioView without breaking its complex layout is to stop it from subscribing to prices.
// We will create an isolated hook just for the numbers that need it, or we will throttle the component.
// Actually, creating a <LivePortfolioStats> wrapper that handles the top section is safest.

pv = pv.replace(/prices: state\.prices,?\s*/g, '');
pv = pv.replace(/, prices /g, ' ');
pv = pv.replace(/prices,/g, '');

const liveStatsDef = `
const LivePortfolioStats = React.memo(({ holdings, positions }) => {
  const prices = useStore(state => state.prices);
  
  let totalInvested = 0;
  let totalCurrent = 0;
  let totalInvestedStocks = 0;
  let totalInvestedETFs = 0;
  let totalInvestedDerivatives = 0;
  let totalInvestedMutualFunds = 0;
  let unrealizedPnl = 0;

  const allMergedHoldingsMap = {};
  (holdings || []).forEach(h => { allMergedHoldingsMap[h.symbol] = { ...h }; });
  const allMergedHoldings = Object.values(allMergedHoldingsMap).filter(h => h.quantity > 0);

  const calculatePnL = (pos, isHolding = false) => {
      if (!pos) return;
      const priceData = prices[pos.symbol] || {};
      const ltp = priceData.ltp || parseFloat(pos.average_price) || 0;
      const qty = Math.abs(Number(pos.quantity) || 0);
      
      const invested = parseFloat(pos.average_price) * qty;
      const current = ltp * qty;
      
      let pnl = 0;
      if (Number(pos.quantity) > 0) pnl = current - invested;
      else if (Number(pos.quantity) < 0) pnl = invested - current;
      unrealizedPnl += pnl;

      if (isHolding) {
          totalInvested += invested;
          totalCurrent += current;
          const symbolStr = pos.symbol || '';
          if (symbolStr.includes('ETF') || symbolStr.includes('BEES') || symbolStr.includes('LIQUID')) totalInvestedETFs += invested;
          else if (symbolStr.endsWith('CE') || symbolStr.endsWith('PE') || symbolStr.endsWith('FUT')) totalInvestedDerivatives += invested;
          else if (symbolStr.includes('MF') || symbolStr.includes('MUTUALFUND')) totalInvestedMutualFunds += invested;
          else totalInvestedStocks += invested;
      }
  };

  allMergedHoldings.forEach(h => calculatePnL(h, true));
  (positions || []).filter(p => p.product_type !== 'DEL').forEach(p => calculatePnL(p, false));

  const pnlPct = totalInvested > 0 ? (unrealizedPnl / totalInvested) * 100 : 0;
  const isProfit = unrealizedPnl >= 0;

  const chartData = [
    { name: 'Stocks', value: totalInvestedStocks, color: '#3B82F6' },
    { name: 'ETFs', value: totalInvestedETFs, color: '#10B981' },
    { name: 'Derivatives', value: totalInvestedDerivatives, color: '#F59E0B' },
    { name: 'Mutual Funds', value: totalInvestedMutualFunds, color: '#8B5CF6' }
  ].filter(d => d.value > 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '500' }}>Total Portfolio Value</div>
          <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-1px', color: 'var(--text-primary)' }}>
            '{totalCurrent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Invested Amount</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>'{totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Unrealized P&L</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: isProfit ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
              {isProfit ? '+' : ''}'{unrealizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style={{ fontSize: '12px', marginLeft: '6px', opacity: 0.8 }}>({isProfit ? '+' : ''}{pnlPct.toFixed(2)}%)</span>
            </div>
          </div>
        </div>
      </div>
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
        <div style={{ width: '140px', height: '140px' }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2} dataKey="value" stroke="none">
                  {chartData.map((entry, index) => <Cell key={\`cell-\${index}\`} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(val) => ''' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 })} contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#F8FAFC' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
             <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '4px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>No Investments</div>
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {chartData.length > 0 ? chartData.map(d => (
            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color }}></div><span style={{ color: 'var(--text-secondary)' }}>{d.name}</span></div>
              <span style={{ fontWeight: '600' }}>{((d.value / totalInvested) * 100).toFixed(0)}%</span>
            </div>
          )) : (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Allocate funds to Equity, ETFs, or F&O to see your portfolio distribution here.</div>
          )}
        </div>
      </div>
    </div>
  );
});
`;

// Insert the new component above PortfolioView
pv = pv.replace("export default function PortfolioView() {", liveStatsDef + "\nexport default function PortfolioView() {");

// Now we need to remove the inline calculations and the inline grid that renders it!
const startInlineMath = `let totalInvested = 0;`;
const endInlineMath = `return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };`;
const idxStart = pv.indexOf(startInlineMath);
const idxEnd = pv.indexOf(endInlineMath) + endInlineMath.length;
if(idxStart > -1 && idxEnd > idxStart) {
  pv = pv.slice(0, idxStart) + pv.slice(idxEnd);
}

// Find the grid that renders the stats and replace with <LivePortfolioStats>
const gridRegex = /<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(auto-fit, minmax\(300px, 1fr\)\)', gap: '20px', marginBottom: '24px' \}\}>[\s\S]*?<\/ResponsiveContainer>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/;
pv = pv.replace(gridRegex, '<LivePortfolioStats holdings={holdings} positions={positions} />');

fs.writeFileSync('frontend/src/components/PortfolioView.jsx', pv);
console.log("Fixed PortfolioView");
