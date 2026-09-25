const fs = require('fs');
let app = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// 1. Remove the entire Background Alert Checking Engine block
const alertStart = app.indexOf('// Background Alert Checking Engine');
if (alertStart !== -1) {
    const alertEnd = app.indexOf('// Client-Side Advanced Order Trigger Engine');
    const toRemove = app.substring(alertStart, alertEnd);
    app = app.replace(toRemove, "");
}

// 2. Remove the entire Client-Side Advanced Order Trigger Engine block
const triggerStart = app.indexOf('// Client-Side Advanced Order Trigger Engine');
if (triggerStart !== -1) {
    // It ends just before `// Theme initialization` or similar. Let's find the `}, [prices, ` array.
    const triggerEndStr = '}, [prices, pendingTriggers, updatePendingTrigger, placeOrder]);';
    const triggerEnd = app.indexOf(triggerEndStr) + triggerEndStr.length;
    if (app.indexOf(triggerEndStr) !== -1) {
        const toRemove2 = app.substring(triggerStart, triggerEnd);
        app = app.replace(toRemove2, "");
    }
}

// 3. Remove the TOP_INDICES block that uses prices
const indicesStart = app.indexOf('<div className="hide-on-tablet" style={{ display: \'flex\', gap: \'6px\' }}>');
if (indicesStart !== -1) {
    // Find the end of this div. It's followed by `<LiveIndexTicker />`? No, wait. 
    const indicesEndStr = '<div style={{ flex: 1 }}></div>';
    const indicesEnd = app.indexOf(indicesEndStr);
    if (indicesEnd !== -1) {
        // We want to replace the whole block with just `<LiveIndexTicker />` or nothing, because `<LiveIndexTicker />` might already be there?
        // Wait, did I add `<LiveIndexTicker />` to the JSX? Let's check `App.jsx`
        const toRemove3 = app.substring(indicesStart, indicesEnd);
        app = app.replace(toRemove3, "<LiveIndexTicker />\n            ");
    }
}

fs.writeFileSync('frontend/src/App.jsx', app);
console.log("Cleaned up lingering prices references in App.jsx.");
