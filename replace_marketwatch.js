const fs = require('fs');

let content = fs.readFileSync('frontend/src/components/MarketWatch.jsx', 'utf8');

// 1. Sidebar background
content = content.replace(
  /<div className={`sidebar \${className}`}>/g,
  '<div className={`sidebar glass-panel ${className}`}>'
);

// 2. Search Bar styling
content = content.replace(
  /className="input-field"/g,
  'className="input-field search-pill"'
);

// 3. List Items hover
content = content.replace(
  /className={`list-item \${selectedSymbol === stock.uniqueSymbol \? 'selected' : ''}`}/g,
  'className={`list-item watchlist-item ${selectedSymbol === stock.uniqueSymbol ? "selected" : ""}`}'
);

// 4. Exchange Badge
content = content.replace(
  /style={{ fontSize: '9px', padding: '2px 4px', background: 'var\(--bg-secondary\)', borderRadius: '4px', color: 'var\(--text-secondary\)' }}/g,
  'style={{ fontSize: "9px", padding: "2px 4px", borderRadius: "4px" }} className={`badge-${stock.exchange?.toLowerCase() || "nse"}`}'
);

// 5. Selected item active font fix
content = content.replace(
  /fontWeight: selectedSymbol === stock.uniqueSymbol \? '600' : '500'/g,
  'fontWeight: selectedSymbol === stock.uniqueSymbol ? "700" : "500", textShadow: selectedSymbol === stock.uniqueSymbol ? "0 0 8px rgba(255,255,255,0.4)" : "none"'
);

fs.writeFileSync('frontend/src/components/MarketWatch.jsx', content);
console.log('done MarketWatch.jsx');
