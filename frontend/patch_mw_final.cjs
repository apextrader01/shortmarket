const fs = require('fs');
let content = fs.readFileSync('src/components/MarketWatch.jsx', 'utf8');

// === FIX 1: Replace the giant single-line useShallow that mixes state + actions ===
const oldSelector = `  const { stocks, selectedSymbol, setSelectedSymbol, fetchBatchPrices, watchlists, activeWatchlistId, setActiveWatchlist, addStockToWatchlist, removeStockFromWatchlist, createWatchlist, deleteWatchlist, renameWatchlist, openOrderModal, openMarketDepthModal, setAlertModalSymbol } = useStore(useShallow(state => ({ stocks: state.stocks, selectedSymbol: state.selectedSymbol, setSelectedSymbol: state.setSelectedSymbol, fetchBatchPrices: state.fetchBatchPrices, watchlists: state.watchlists, activeWatchlistId: state.activeWatchlistId, setActiveWatchlist: state.setActiveWatchlist, addStockToWatchlist: state.addStockToWatchlist, removeStockFromWatchlist: state.removeStockFromWatchlist, createWatchlist: state.createWatchlist, deleteWatchlist: state.deleteWatchlist, renameWatchlist: state.renameWatchlist, openOrderModal: state.openOrderModal, openMarketDepthModal: state.openMarketDepthModal, setAlertModalSymbol: state.setAlertModalSymbol })));`;

const newSelector = `  // [HOTFIX] Only subscribe to STATE values (not actions) to prevent Error #185 infinite loop
  const { stocks, selectedSymbol, watchlists, activeWatchlistId } = useStore(useShallow(state => ({
    stocks: state.stocks, selectedSymbol: state.selectedSymbol,
    watchlists: state.watchlists, activeWatchlistId: state.activeWatchlistId,
  })));
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

if (!content.includes(oldSelector.trim())) {
  console.error('FIX1 TARGET NOT FOUND');
  process.exit(1);
}
content = content.replace(oldSelector, newSelector);
console.log('FIX1: Done');

// === FIX 2: Add symbolsKey BEFORE the displayStocks line, and fix the dep array ===
const oldDisplayLine = `  const displayStocks = isSearchMode ? filteredSearchResults : watchlistStocks;

  React.useEffect(() => {`;

const newDisplayLine = `  const displayStocks = isSearchMode ? filteredSearchResults : watchlistStocks;

  // [HOTFIX] Stable string dep — only changes when symbol list changes, not on every price tick
  const symbolsKey = isSearchMode
    ? searchResults.map(s => s.uniqueSymbol).join(',')
    : (activeWatchlist?.symbols || []).join(',');

  React.useEffect(() => {`;

if (!content.includes(oldDisplayLine)) {
  console.error('FIX2 TARGET NOT FOUND');
  process.exit(1);
}
content = content.replace(oldDisplayLine, newDisplayLine);
console.log('FIX2: Done');

// === FIX 3: Replace the bad inline dep array ===
const oldDeps = `  }, [isSearchMode, searchResults.map(s => s.uniqueSymbol).join(','), activeWatchlist.symbols.join(',')]);`;
const newDeps = `  }, [isSearchMode, symbolsKey]); // [HOTFIX] Stable dep prevents Error #185`;

if (!content.includes(oldDeps)) {
  console.error('FIX3 TARGET NOT FOUND');
  process.exit(1);
}
content = content.replace(oldDeps, newDeps);
console.log('FIX3: Done');

fs.writeFileSync('src/components/MarketWatch.jsx', content);
console.log('All fixes applied successfully!');
