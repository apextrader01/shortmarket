const fs = require('fs');
let file = 'frontend/src/components/MarketWatch.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove prices from useShallow in MarketWatch
content = content.replace('prices: state.prices, ', '');
content = content.replace('prices, ', '');

// 2. Extract WatchlistRow
// We need to inject WatchlistRow right above MarketWatch
const watchListRowCode = `
const WatchlistRow = React.memo(({ stock, isSearchMode, activeWatchlistId, watchlists, onStockSelect }) => {
  const isSelected = useStore(state => state.selectedSymbol) === stock.uniqueSymbol;
  const setSelectedSymbol = useStore(state => state.setSelectedSymbol);
  
  // ONLY subscribe to the price for this specific stock
  const data = useStore(state => state.prices[stock.uniqueSymbol]);
  
  // Actions
  const addStockToWatchlist = useStore(state => state.addStockToWatchlist);
  const removeStockFromWatchlist = useStore(state => state.removeStockFromWatchlist);
  const openOrderModal = useStore(state => state.openOrderModal);
  const openMarketDepthModal = useStore(state => state.openMarketDepthModal);
  const setAlertModalSymbol = useStore(state => state.setAlertModalSymbol);
  
  // Internal UI state
  const [isHovered, setIsHovered] = React.useState(false);
  
  const isUp = data?.pct >= 0;
  const isDown = data?.pct < 0;
  
  const activeWatchlist = watchlists.find(w => w.id === activeWatchlistId);
  const isInWatchlist = activeWatchlist?.symbols.includes(stock.uniqueSymbol);
  const currentLotsize = stock.lotsize || data?.lotsize || 1;

  return (
    <div
      onClick={() => {
        setSelectedSymbol(stock.uniqueSymbol);
        if (onStockSelect) onStockSelect();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={\`watchlist-item \${isSelected ? 'selected hover-glow' : 'hover-glow'}\`}
      style={{
        padding: '6px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
        background: isSelected ? 'transparent' : isHovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative'
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: isSelected ? '700' : '600', textShadow: isSelected ? '0 0 8px rgba(255,255,255,0.4)' : 'none', fontSize: '12px', letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {stock.symbol}
          <span className={\`badge-\${stock.exchange?.toLowerCase() || 'nse'}\`} style={{ fontSize: '9px', padding: '1px 3px', borderRadius: '3px' }}>
            {stock.exchange}
          </span>
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{stock.description || stock.name}</div>
      </div>

      {(isHovered || isSearchMode) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '8px' }}>
          {isSearchMode ? (
            isInWatchlist ? (
              <div 
                onClick={(e) => { e.stopPropagation(); removeStockFromWatchlist(activeWatchlistId, stock.uniqueSymbol); }}
                style={{ padding: '3px', background: 'var(--color-red)', borderRadius: '4px', display: 'flex' }}
              >
                <Minus size={12} color="#fff" />
              </div>
            ) : (
              <div 
                onClick={(e) => { e.stopPropagation(); addStockToWatchlist(activeWatchlistId, stock.uniqueSymbol); }}
                style={{ padding: '3px', background: 'var(--color-blue)', borderRadius: '4px', display: 'flex' }}
              >
                <Plus size={12} color="#fff" />
              </div>
            )
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div 
                onClick={(e) => { e.stopPropagation(); openOrderModal(stock.uniqueSymbol, 'BUY', currentLotsize); }}
                style={{ padding: '2px 6px', background: 'var(--color-blue)', borderRadius: '3px', color: '#fff', fontSize: '10px', fontWeight: 'bold', display: 'flex', cursor: 'pointer' }}
              >
                B
              </div>
              <div 
                onClick={(e) => { e.stopPropagation(); openOrderModal(stock.uniqueSymbol, 'SELL', currentLotsize); }}
                style={{ padding: '2px 6px', background: 'var(--color-red)', borderRadius: '3px', color: '#fff', fontSize: '10px', fontWeight: 'bold', display: 'flex', cursor: 'pointer' }}
              >
                S
              </div>
              <div 
                onClick={(e) => { e.stopPropagation(); setAlertModalSymbol(stock.uniqueSymbol); }}
                style={{ padding: '3px', background: 'var(--border-color)', borderRadius: '3px', display: 'flex', marginLeft: '2px', cursor: 'pointer' }}
                title="Set Price Alert"
              >
                <Bell size={12} color="var(--color-yellow)" />
              </div>
              <div 
                onClick={(e) => { e.stopPropagation(); removeStockFromWatchlist(activeWatchlistId, stock.uniqueSymbol); }}
                style={{ padding: '3px', background: 'var(--border-color)', borderRadius: '3px', display: 'flex', marginLeft: '2px' }}
                title="Remove"
              >
                <Trash2 size={12} color="var(--color-red-light)" />
              </div>
              <div 
                onClick={(e) => { e.stopPropagation(); openMarketDepthModal(stock.uniqueSymbol, currentLotsize); }}
                style={{ padding: '3px', background: 'var(--border-color)', borderRadius: '3px', display: 'flex', marginLeft: '2px' }}
                title="Market Depth"
              >
                <AlignRight size={12} color="var(--color-blue)" />
              </div>
            </div>
          )}
        </div>
      )}

      {data && !(isHovered || isSearchMode) ? (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div 
            key={data.last_update_time || data.ltp}
            className={data.tickDirection === 1 ? 'flash-up' : data.tickDirection === -1 ? 'flash-down' : ''}
            style={{
              fontWeight: '600',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '4px',
              padding: '2px 4px',
              color: isUp ? 'var(--color-green-light)' : isDown ? 'var(--color-red-light)' : 'var(--text-primary)'
            }}
          >
            {data.ltp.toFixed(2)}
            {isUp ? <TrendingUp size={10} /> : isDown ? <TrendingDown size={10} /> : null}
          </div>
          <div style={{
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            justifyContent: 'flex-end',
            color: isUp ? 'var(--color-green-light)' : isDown ? 'var(--color-red-light)' : 'var(--text-secondary)'
          }}>
            {data.change !== undefined && data.pct !== undefined 
              ? `${data.pct > 0 ? '+' : ''}${Number(data.change).toFixed(2)} (${data.pct > 0 ? '+' : ''}${Number(data.pct).toFixed(2)}%)` 
              : '?"'}
          </div>
        </div>
      ) : !data && !(isHovered || isSearchMode) ? (
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>?"</div>
      ) : null}
    </div>
  );
});

export default function MarketWatch`;

content = content.replace('export default function MarketWatch', watchListRowCode);

// 3. Replace map body
const mapStart = content.indexOf('{displayStocks.map(stock => {');
const mapEnd = content.indexOf('</div>', content.indexOf('stocks {isSearchMode ? \'found\' : \'in list\'}')) - 100;
// We actually just want to replace the body of the map with <WatchlistRow />

// Let's use regex to replace everything between {displayStocks.map(stock => { ... })} with {displayStocks.map(stock => <WatchlistRow ... />)}
const replacementMap = `{displayStocks.map(stock => (
          <WatchlistRow
            key={stock.uniqueSymbol}
            stock={stock}
            isSearchMode={isSearchMode}
            activeWatchlistId={activeWatchlistId}
            watchlists={watchlists}
            onStockSelect={onStockSelect}
          />
        ))}
      </div>`;

const reBody = /\{displayStocks\.map\(stock => \{[\s\S]*?(?=\<\/div>\s*<div style=\{\{ padding: '10px 16px')/g;
content = content.replace(reBody, replacementMap);

// Remove hoveredStock state from MarketWatch (no longer needed)
content = content.replace('const [hoveredStock, setHoveredStock] = useState(null);', '');

fs.writeFileSync(file, content);
console.log('MarketWatch decoupled successfully!');
