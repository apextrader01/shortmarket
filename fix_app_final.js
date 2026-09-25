const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// Strip out prices from the main hook
code = code.replace(/prices: state\.prices,?\s*/g, '');
code = code.replace(/, prices \} = useStore/, ' } = useStore');
code = code.replace(/prices,/g, '');

const injectedComponents = `
// Decoupled Background Watcher for Alerts & Triggers
const BackgroundWatcher = React.memo(() => {
  const prices = useStore(state => state.prices);
  const alerts = useStore(state => state.alerts);
  const updateAlert = useStore(state => state.updateAlert);
  const pendingTriggers = useStore(state => state.pendingTriggers);
  const updatePendingTrigger = useStore(state => state.updatePendingTrigger);
  const placeOrder = useStore(state => state.placeOrder);

  useEffect(() => {
    alerts.forEach(alert => {
      if (alert.triggered) return;
      const priceData = prices[alert.symbol];
      if (!priceData) return;
      const ltp = priceData.ltp;
      
      let triggered = false;
      if (alert.condition === 'ABOVE' && ltp > alert.targetPrice) triggered = true;
      else if (alert.condition === 'BELOW' && ltp < alert.targetPrice) triggered = true;

      if (triggered) {
        updateAlert(alert.id, { triggered: true });
        if (Notification.permission === 'granted') {
          new Notification("Price Alert Triggered! ", {
            body: \`\${alert.symbol} crossed \${alert.condition.toLowerCase()} \${alert.targetPrice}. Current price is \${ltp.toFixed(2)}\`,
            icon: '/favicon.ico'
          });
        }
      }
    });
  }, [prices, alerts, updateAlert]);

  useEffect(() => {
    pendingTriggers.forEach(trigger => {
      if (trigger.status !== 'PENDING_TRIGGER') return;
      const priceData = prices[trigger.symbol];
      if (!priceData) return;
      const ltp = priceData.ltp;
      let shouldTrigger = false;
      
      if (trigger.type === 'GTT') {
         if (trigger.side === 'BUY' && ltp <= trigger.triggerPrice) shouldTrigger = true;
         if (trigger.side === 'SELL' && ltp >= trigger.triggerPrice) shouldTrigger = true;
      } else if (trigger.type === 'SL') {
         if (trigger.side === 'BUY' && ltp >= trigger.triggerPrice) shouldTrigger = true;
         if (trigger.side === 'SELL' && ltp <= trigger.triggerPrice) shouldTrigger = true;
      }
      if (trigger.type === 'TRAILING_SL') {
         if (trigger.side === 'BUY' && ltp >= trigger.triggerPrice) shouldTrigger = true;
         if (trigger.side === 'SELL' && ltp <= trigger.triggerPrice) shouldTrigger = true;
      }

      if (shouldTrigger) {
        updatePendingTrigger(trigger.id, { status: 'EXECUTED_TRIGGER' });
        placeOrder({
          symbol: trigger.symbol,
          side: trigger.side,
          quantity: trigger.quantity,
          type: trigger.limitPrice ? 'LIMIT' : 'MARKET',
          price: trigger.limitPrice || 0,
          product_type: trigger.product_type,
          parent_order_id: trigger.parent_order_id
        });
      }
    });
  }, [prices, pendingTriggers, updatePendingTrigger, placeOrder]);

  return null;
});

// Decoupled Header Ticker for Top Indices
const LiveIndexTicker = React.memo(() => {
  const prices = useStore(state => state.prices);
  const TOP_INDICES = ['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX'];
  return (
    <div className="hide-on-tablet" style={{ display: 'flex', gap: '6px' }}>
      {TOP_INDICES.map((idx) => {
        const p = prices[idx];
        const isUp = p?.pct >= 0;
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>{idx.replace('NSE:', '').replace('BSE:', '').replace('-INDEX', '')}</span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: p ? (isUp ? 'var(--color-green-light)' : 'var(--color-red-light)') : 'var(--text-secondary)' }}>
              {p ? p.ltp.toFixed(2) : '---'}
            </span>
          </div>
        );
      })}
    </div>
  );
});
`;

code = code.replace("function App() {", injectedComponents + "\nfunction App() {");

// Remove const price = prices[selectedSymbol];
code = code.replace(/const price = prices\[selectedSymbol\];/g, '');

// Strip out the two useEffect loops for alerts/triggers from App
const alertsBlockStart = `  // --- Local Watchdogs (Fallback) ---`;
const alertsBlockEnd = `  // -----------------------------------------------------------------------------------------------------------------`;

const idxS = code.indexOf(alertsBlockStart);
const idxE = code.indexOf(alertsBlockEnd);

if (idxS > -1 && idxE > -1) {
   code = code.slice(0, idxS) + code.slice(idxE);
}

// Strip out the TOP_INDICES logic from the header and insert the <LiveIndexTicker />
const headerStart = `<div className="hide-on-tablet" style={{ display: 'flex', gap: '6px' }}>`;
const headerEnd = `</div>
            </div>`;
// This regex will find the exact block since it's the only one with TOP_INDICES.map
const topIndicesRegex = /<div className="hide-on-tablet" style=\{\{ display: 'flex', gap: '6px' \}\}>[\s\S]*?TOP_INDICES\.map[\s\S]*?<\/div>\s*\)\s*;\s*}\)\}\s*<\/div>/;

code = code.replace(topIndicesRegex, '<LiveIndexTicker />');

// Insert <BackgroundWatcher /> right after <div className="app-container" ...>
code = code.replace(/<div className="app-container".*?>/, '$&\n      <BackgroundWatcher />');

fs.writeFileSync('frontend/src/App.jsx', code);
console.log('Fixed App.jsx');
