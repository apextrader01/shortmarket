const fs = require('fs');
let app = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const str1 = `  // Background Alert Checking Engine
  useEffect(() => {
    alerts.forEach(alert => {
      if (alert.triggered) return;
      const priceData = useStore.getState().prices[alert.symbol];
      if (!priceData) return;
      
      const ltp = priceData.ltp;
      let triggered = false;
      
      if (alert.condition === 'ABOVE' && ltp >= alert.targetPrice) {
        triggered = true;
      } else if (alert.condition === 'BELOW' && ltp <= alert.targetPrice) {
        triggered = true;
      }
      
      if (triggered) {
        updateAlert(alert.id, { triggered: true, triggeredAt: new Date().toISOString(), triggerPrice: ltp });
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Price Alert Triggered! Ys", {
            body: \`\${alert.symbol} crossed \${alert.condition.toLowerCase()} '\${alert.targetPrice}. Current price is '\${ltp.toFixed(2)}\`,
            icon: '/logo.png'
          });
        }
      }
    });
  }, [ alerts, updateAlert]);`;

const str2 = `  // Client-Side Advanced Order Trigger Engine
  useEffect(() => {
    pendingTriggers.forEach(trigger => {
      if (trigger.status !== 'PENDING_TRIGGER') return;
      const priceData = useStore.getState().prices[trigger.symbol];
      if (!priceData) return;
      
      const ltp = priceData.ltp;
      
      let isBreached = false;
      let newTriggerPrice = trigger.triggerPrice;
      
      // GTT Logic: usually GTT BUY is when price drops to/below trigger, GTT SELL is when price rises to/above trigger.
      if (trigger.type === 'GTT') {
         if (trigger.side === 'BUY' && ltp <= trigger.triggerPrice) isBreached = true;
         if (trigger.side === 'SELL' && ltp >= trigger.triggerPrice) isBreached = true;
      } 
      // Stop Loss Logic: SL BUY is when price rises to/above trigger, SL SELL is when price drops to/below trigger.
      else if (trigger.type === 'SL' || trigger.type === 'TRAILING_SL') {
         if (trigger.side === 'BUY' && ltp >= trigger.triggerPrice) isBreached = true;
         if (trigger.side === 'SELL' && ltp <= trigger.triggerPrice) isBreached = true;
         
         // Trailing logic
         if (trigger.type === 'TRAILING_SL' && trigger.trailingJump > 0 && !isBreached) {
            if (trigger.side === 'BUY') {
                // If we are short (buy to cover SL), as price drops, we trail SL down.
                // But normally trailing SL is relative to a reference price. 
                // For simplicity: if LTP drops below (triggerPrice - trailingJump), we move triggerPrice down.
                if (ltp <= trigger.triggerPrice - trigger.trailingJump) {
                    newTriggerPrice = trigger.triggerPrice - trigger.trailingJump;
                    updatePendingTrigger(trigger.id, { triggerPrice: newTriggerPrice });
                }
            } else {
                // If we are long (sell SL), as price rises, we trail SL up.
                if (ltp >= trigger.triggerPrice + trigger.trailingJump) {
                    newTriggerPrice = trigger.triggerPrice + trigger.trailingJump;
                    updatePendingTrigger(trigger.id, { triggerPrice: newTriggerPrice });
                }
            }
         }
      }
      
      if (isBreached) {
         updatePendingTrigger(trigger.id, { status: 'EXECUTED', executedAt: new Date().toISOString(), executionPrice: ltp });
         
         // Fire the real order!
         placeOrder({
            symbol: trigger.symbol,
            type: trigger.limitPrice ? 'LIMIT' : 'MARKET',
            side: trigger.side,
            quantity: trigger.quantity,
            price: trigger.limitPrice || 0,
            product_type: trigger.productType
         });
         
         if ("Notification" in window && Notification.permission === "granted") {
           new Notification(\`\${trigger.type} Order Triggered! YZ\`, {
             body: \`\${trigger.side} \${trigger.quantity} \${trigger.symbol} @ '\${ltp.toFixed(2)}\`,
             icon: '/logo.png'
           });
         }
      }
    });
  }, [ pendingTriggers, updatePendingTrigger, placeOrder]);`;

if (app.includes(str1)) {
    app = app.replace(str1, "// [REMOVED]: Background Alert Checking Engine (Duplicate)");
}
if (app.includes(str2)) {
    app = app.replace(str2, "// [REMOVED]: Client-Side Advanced Order Trigger Engine (Duplicate)");
}

fs.writeFileSync('frontend/src/App.jsx', app);
console.log("Deleted duplicates.");
