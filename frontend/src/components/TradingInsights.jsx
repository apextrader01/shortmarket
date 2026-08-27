const TradingInsights = () => {
  const [filterPeriod, setFilterPeriod] = useState('Month');
  
  const { positions, orders } = useStore(useShallow(state => ({ 
    positions: state.positions, 
    orders: state.orders 
  })));

  // Daily orders (for Day Trades list)
  const executedOrders = (orders || []).filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');

  // Aggregate metrics from historical orders instead of positions (since positions are wiped at EOD)
  let grossPnl = 0;
  let profitableTrades = 0;
  let lossTrades = 0;
  let totalTrades = 0;
  let totalGrossProfit = 0;
  let totalGrossLoss = 0;

  executedOrders.forEach(o => {
    // Only count orders that generated a realized PnL
    if (o.realized_pnl !== null && o.realized_pnl !== undefined && parseFloat(o.realized_pnl) !== 0) {
      const pnl = parseFloat(o.realized_pnl);
      grossPnl += pnl;
      totalTrades++;
      if (pnl > 0) {
        profitableTrades++;
        totalGrossProfit += pnl;
      } else if (pnl < 0) {
        lossTrades++;
        totalGrossLoss += Math.abs(pnl);
      }
    }
  });

  const profitableTradePercent = totalTrades > 0 ? ((profitableTrades / totalTrades) * 100).toFixed(1) : '-';
  const profitFactor = totalGrossLoss > 0 ? (totalGrossProfit / totalGrossLoss).toFixed(2) : (totalGrossProfit > 0 ? 'MAX' : '-');

  // Daily orders (for Day Trades list)
  const executedOrders = (orders || []).filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');
  
  const StatCard = ({ title, value, sub, icon: Icon, colorClass }) => (
    <div className="glass-panel hoverable" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '160px', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{title}</div>
        {Icon && <Icon size={16} color="var(--text-secondary)" />}
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: colorClass ? \ar(\)\ : 'white' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header / Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
           <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Instrument: <span style={{ color: 'var(--color-blue-light)' }}>F/O Trading Insights</span></div>
           <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', overflow: 'hidden' }}>
             {['Week', '15 Days', 'Month', '3 Months', 'Custom'].map(f => (
               <div key={f} onClick={() => setFilterPeriod(f)} style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', background: filterPeriod === f ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: filterPeriod === f ? 'var(--color-blue-light)' : 'var(--text-secondary)' }}>
                 {f}
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div>
        <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>F&O Key Metrics</div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <StatCard title="Gross P/L" value={\\₹\\} colorClass={grossPnl >= 0 ? '--color-green-light' : '--color-red-light'} />
          <StatCard title="Profitable Day %" value="-" sub="DAYS" />
          <StatCard title="Profitable Trade %" value={\\%\} sub={\\ TRADES\} colorClass="--color-green-light" />
          <StatCard title="Profit Factor" value={profitFactor} icon={Target} />
          <StatCard title="Avg. Holding Time" value="-" icon={Clock} />
        </div>
      </div>

      {/* Day Summary Progress Bar */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '24px' }}>Day Summary</div>
        {totalTrades === 0 ? (
           <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>No trade data</div>
        ) : (
          <>
            <div style={{ height: '8px', display: 'flex', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ width: \\%\, background: 'var(--color-green-light)' }}></div>
              <div style={{ width: \\%\, background: 'var(--color-red-light)' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div>Profitable Trades ({profitableTrades})</div>
              <div>Loss Making Trades ({lossTrades})</div>
            </div>
          </>
        )}
      </div>

      {/* Heatmap */}
      <div className="glass-panel" style={{ padding: '24px' }}>
         <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '24px' }}>Performance</div>
         <PnLCalendarHeatmap positions={positions} orders={orders} />
      </div>

      {/* Trades List */}
      <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
        <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '24px' }}>Per Day Trade Summary</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '600px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
              <th style={{ padding: '12px', fontWeight: '500' }}>Scrip Name</th>
              <th style={{ padding: '12px', fontWeight: '500' }}>Timing</th>
              <th style={{ padding: '12px', fontWeight: '500' }}>Type</th>
              <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Quantity</th>
              <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Net P/L</th>
            </tr>
          </thead>
          <tbody>
            {executedOrders.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trade data available</td></tr>
            ) : (
              executedOrders.slice().reverse().slice(0, 50).map((o, idx) => {
                const isPnLAvailable = o.realized_pnl !== null && o.realized_pnl !== undefined && parseFloat(o.realized_pnl) !== 0;
                const pnl = isPnLAvailable ? parseFloat(o.realized_pnl).toFixed(2) : '--';
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{o.symbol}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{new Date(o.created_at).toLocaleString()}</td>
                    <td style={{ padding: '12px' }}>
                       <span style={{ color: o.side === 'BUY' ? 'var(--color-blue-light)' : 'var(--color-red-light)', background: 'var(--bg-hover)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                          {o.side}
                       </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{o.quantity}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: pnl > 0 ? 'var(--color-green-light)' : (pnl < 0 ? 'var(--color-red-light)' : 'var(--text-secondary)') }}>
                       {pnl > 0 ? '+' : ''}{pnl !== '--' ? `₹${pnl}` : pnl}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


