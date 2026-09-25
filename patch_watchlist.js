const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MarketWatch.jsx', 'utf8');

const regex = /displayStocks\.map\(stock => \{[\s\S]*?\}\)\}\s*<\/div>\s*<div style=\{\{ padding: '10px 16px'/;

const replacementMap = `displayStocks.map(stock => (
          <WatchlistRow
            key={stock.uniqueSymbol}
            stock={stock}
            isSelected={selectedSymbol === stock.uniqueSymbol}
            isSearchMode={isSearchMode}
            isInWatchlist={activeWatchlist.symbols.includes(stock.uniqueSymbol)}
            activeWatchlistId={activeWatchlistId}
            setSelectedSymbol={setSelectedSymbol}
            onStockSelect={onStockSelect}
            removeStockFromWatchlist={removeStockFromWatchlist}
            addStockToWatchlist={addStockToWatchlist}
            openOrderModal={openOrderModal}
            setAlertModalSymbol={setAlertModalSymbol}
            openMarketDepthModal={openMarketDepthModal}
            searchLotsizes={searchLotsizes}
          />
        ))}
      </div>

      <div style={{ padding: '10px 16px'`;

if (code.match(regex)) {
    code = code.replace(regex, replacementMap);
    // Remove hoveredStock from MarketWatch state
    code = code.replace(/const \[hoveredStock, setHoveredStock\] = useState\(null\);\n\s*/, '');
    fs.writeFileSync('frontend/src/components/MarketWatch.jsx', code);
    console.log('Successfully replaced map block using regex');
} else {
    console.error('Regex did not match!');
}
