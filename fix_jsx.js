const fs = require('fs');
let file = fs.readFileSync('frontend/src/components/PortfolioView.jsx', 'utf8');

const oldBlock = `  return (
    <LivePortfolioStats holdings={holdings} positions={positions} />
              <span style={{ fontWeight: '600' }}>{((d.value / totalInvested) * 100).toFixed(0)}%</span>
            </div>
          )) : (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Allocate funds to Equity, ETFs, or F&O to see your portfolio distribution here.</div>
          )}
        </div>
      </div>
    </div>
  );`;

const newBlock = `  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
      <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Total Portfolio Value</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '12px' }}>
          ?{totalCurrent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Invested</div>
            <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: '500' }}>?{totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Unrealized P&L</div>
            <div style={{ fontSize: '15px', color: isProfit ? 'var(--color-green)' : 'var(--color-red)', fontWeight: '600' }}>
              {isProfit ? '+' : ''}{unrealizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({pnlPct.toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ width: '120px', height: '120px', flexShrink: 0 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={45} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                  {chartData.map((entry, index) => (
                    <Cell key={\`cell-\${index}\`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => '?' + val.toLocaleString('en-IN')} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '4px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Empty</span>
            </div>
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {chartData.length > 0 ? chartData.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: d.color }}></div>
                <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
              </div>
              <span style={{ fontWeight: '600' }}>{((d.value / totalInvested) * 100).toFixed(0)}%</span>
            </div>
          )) : (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Allocate funds to Equity, ETFs, or F&O to see your portfolio distribution here.</div>
          )}
        </div>
      </div>
    </div>
  );`;

if (file.includes('return (\n    <LivePortfolioStats holdings={holdings} positions={positions} />')) {
    file = file.replace(oldBlock, newBlock);
    
    // Now we also need to fix PortfolioOverviewTab to render the actual LivePortfolioStats correctly
    // Wait, PortfolioOverviewTab doesn't exist. The component is just PortfolioView.
    // PortfolioView currently renders WHAT? Let's check PortfolioView's return function!
    fs.writeFileSync('frontend/src/components/PortfolioView.jsx', file);
    console.log("Replaced broken JSX inside LivePortfolioStats");
} else {
    console.log("Could not find the block to replace.");
}
