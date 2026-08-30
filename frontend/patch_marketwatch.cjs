const fs = require('fs');
let content = fs.readFileSync('src/components/MarketWatch.jsx', 'utf8');

// Fix 1: Replace the giant useStore(useShallow(...)) that includes actions alongside state
// Split into: state-only useShallow + individual action selectors
const oldSelector = `  const { stocks, selectedSymbol, setSelectedSymbol, fetchBatchPrices, watchlists, activeWatchlistId, setActiveWatchlist, addStockToWatchlist, removeStockFromWatchlist, createWatchlist, deleteWatchlist, renameWatchlist, openOrderModal, openMarketDepthModal, setAlertModalSymbol } = useStore(useShallow(state => ({ stocks: state.stocks, selectedSymbol: state.selectedSymbol, setSelectedSymbol: state.setSelectedSymbol, fetchBatchPrices: state.fetchBatchPrices, watchlists: state.watchlists, activeWatchlistId: state.activeWatchlistId, setActiveWatchlist: state.setActiveWatchlist, addStockToWatchlist: state.addStockToWatchlist, removeStockFromWatchlist: state.removeStockFromWatchlist, createWatchlist: state.createWatchlist, deleteWatchlist: state.deleteWatchlist, renameWatchlist: state.renameWatchlist, openOrderModal: state.openOrderModal, openMarketDepthModal: state.openMarketDepthModal, setAlertModalSymbol: state.setAlertModalSymbol })));`;

const newSelector = `  // [HOTFIX] Only subscribe to actual STATE (not actions) to prevent Error #185 infinite loop.
  const { stocks, selectedSymbol, watchlists, activeWatchlistId } = useStore(useShallow(state => ({
    stocks: state.stocks,
    selectedSymbol: state.selectedSymbol,
    watchlists: state.watchlists,
    activeWatchlistId: state.activeWatchlistId,
  })));
  // Actions are stable refs — access via getState() or individual selectors (never cause re-renders)
  const setSelectedSymbol = useStore(state => state.setSelectedSymbol);
  const addStockToWatchlist = useStore(state => state.addStockToWatchlist);
  const removeStockFromWatchlist = useStore(state => state.removeStockFromWatchlist);
  const createWatchlist = useStore(state => state.createWatchlist);
  const deleteWatchlist = useStore(state => state.deleteWatchlist);
  const renameWatchlist = useStore(state => state.renameWatchlist);
  const setActiveWatchlist = useStore(state => state.setActiveWatchlist);
  const openOrderModal = useStore(state => state.openOrderModal);
  const openMarketDepthModal = useStore(state => state.openMarketDepthModal);
  const setAlertModalSymbol = useStore(state => state.setAlertModalSymbol);`;

if (!content.includes(oldSelector)) {
  console.error('ERROR: Could not find old selector to replace!');
  process.exit(1);
}
content = content.replace(oldSelector, newSelector);

// Fix 2: Replace the unstable dep array with a stable string key
const oldDeps = `  }, [isSearchMode, searchResults.map(s => s.uniqueSymbol).join(','), activeWatchlist.symbols.join(',')]);`;
const newDeps = `  // [HOTFIX] symbolsKey is a stable string that only changes when the watchlist changes,
  // not on every price tick. This prevents Error #185 infinite loop.
  }, [isSearchMode, symbolsKey]);`;

// First insert symbolsKey computation before the 2nd useEffect
const insertBefore = `  React.useEffect(() => {
    // Collect all stocks currently visible (watchlist or search results)
    const visibleStocks = isSearchMode ? filteredSearchResults : watchlistStocks;`;
const symbolsKeyCode = `  const symbolsKey = isSearchMode
    ? searchResults.map(s => s.uniqueSymbol).join(',')
    : (activeWatchlist?.symbols || []).join(',');

  React.useEffect(() => {
    // Collect all stocks currently visible (watchlist or search results)
    const visibleStocks = isSearchMode ? filteredSearchResults : watchlistStocks;`;

content = content.replace(insertBefore, symbolsKeyCode);
content = content.replace(oldDeps, newDeps);

fs.writeFileSync('src/components/MarketWatch.jsx', content);
console.log('Done. Verify:', content.includes('symbolsKey'));
