const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

app = app.replace(/const priceData = prices\[alert\.symbol\];/g, "const priceData = useStore.getState().prices[alert.symbol];");
app = app.replace(/const priceData = prices\[trigger\.symbol\];/g, "const priceData = useStore.getState().prices[trigger.symbol];");
app = app.replace(/const p      = prices\[idx\];/g, "const p      = useStore.getState().prices[idx];");

fs.writeFileSync('src/App.jsx', app);
console.log("Safely bypassed prices reference errors.");
