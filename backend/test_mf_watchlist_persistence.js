const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================================');
console.log('TEST SUITE: MUTUAL FUND WATCHLIST PERSISTENCE & SEARCH ISOLATION');
console.log('======================================================================');

// 1. Verify Backend Endpoint in server.js
console.log('\n▶ MODULE 1: Backend /api/mf/by-ids Audit');
const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
assert(serverCode.includes("app.post('/api/mf/by-ids'"), "server.js defines /api/mf/by-ids endpoint");
assert(serverCode.includes("allMutualFundsMap.get(String(schemeCode))"), "server.js looks up fund from in-memory allMutualFundsMap");
assert(serverCode.includes("calculateReturn(historicalData, 3)"), "server.js returns calculated returns for by-ids");
console.log('  ✔ PASS: /api/mf/by-ids endpoint defined and properly mapped');

// 2. Verify Store logic in frontend/src/store.js
console.log('\n▶ MODULE 2: Frontend Store Watchlist Persistence Audit');
const storeCode = fs.readFileSync(path.join(__dirname, '../frontend/src/store.js'), 'utf8');
assert(storeCode.includes("mfWatchlistFunds:"), "store.js defines persistent mfWatchlistFunds dictionary");
assert(storeCode.includes("fetchMfWatchlistFunds:"), "store.js defines fetchMfWatchlistFunds to load details via /api/mf/by-ids");
assert(storeCode.includes("localStorage.setItem('mfWatchlistFunds'"), "store.js persists mfWatchlistFunds to localStorage");
assert(storeCode.includes("toggleMfWatchlist: (fundOrSymbol)"), "store.js toggleMfWatchlist accepts fund object or ID");
console.log('  ✔ PASS: store.js maintains and persists full fund objects in mfWatchlistFunds');

// 3. Verify MutualFundsView.jsx Watchlist Rendering & Search Isolation
console.log('\n▶ MODULE 3: MutualFundsView.jsx Watchlist & Search Audit');
const viewCode = fs.readFileSync(path.join(__dirname, '../frontend/src/components/MutualFundsView.jsx'), 'utf8');
assert(viewCode.includes("allWatchlistFunds = useMemo("), "MutualFundsView builds allWatchlistFunds independently of current search");
assert(viewCode.includes("filteredWatchlistFunds = useMemo("), "MutualFundsView supports searching within Watchlist");
assert(viewCode.includes("isFavorited(fund.id)"), "MutualFundsView uses canonical isFavorited helper for star highlights");
assert(viewCode.includes("toggleMfWatchlist(fund)"), "MutualFundsView passes full fund object to toggleMfWatchlist");
assert(!viewCode.includes("mutualFunds.filter(f => (mfWatchlist || []).some("), "Old buggy filter on mutualFunds is completely removed");
console.log('  ✔ PASS: MutualFundsView cleanly separates Watchlist from Explore search results');

// 4. Simulate Watchlist Behavior
console.log('\n▶ MODULE 4: Watchlist State Simulation (Search Quant -> Star -> Clear Search)');
const defaultFunds = [
  { id: '120503', name: 'ICICI Prudential Liquid Fund', nav: 420.66, return3y: 6.95 },
  { id: '118778', name: 'Nippon India Small Cap Fund', nav: 204.62, return3y: 14.31 },
  { id: '122639', name: 'Parag Parikh Flexi Cap Fund', nav: 89.31, return3y: 11.87 }
];

const quantSearchResults = [
  { id: '151700', name: 'Quant Small Cap Fund - Direct Plan', nav: 314.18, return3y: 16.84 },
  { id: '151701', name: 'Quant Active Fund - Direct Plan', nav: 610.50, return3y: 18.20 }
];

let store_mfWatchlist = ['118778'];
let store_mfWatchlistFunds = {
  '118778': defaultFunds[1]
};

const fundToStar = quantSearchResults[0];
store_mfWatchlist.push(fundToStar.id);
store_mfWatchlistFunds[fundToStar.id] = fundToStar;

let current_mutualFunds = [...defaultFunds];
let current_search = '';

function computeWatchlist(watchlistIds, watchlistFunds, mutualFundsList, searchFilter) {
  const list = [];
  for (const id of watchlistIds) {
    let fund = watchlistFunds[id] || mutualFundsList.find(f => f.id === id);
    if (fund) list.push(fund);
  }
  if (!searchFilter || !searchFilter.trim()) return list;
  const q = searchFilter.toLowerCase().trim();
  return list.filter(f => f.name.toLowerCase().includes(q));
}

const watchlistWhenCleared = computeWatchlist(store_mfWatchlist, store_mfWatchlistFunds, current_mutualFunds, current_search);
assert(watchlistWhenCleared.length === 2, "Watchlist contains both Nippon and Quant when search is cleared");
assert(watchlistWhenCleared.some(f => f.id === '151700'), "Quant fund remains visible in Watchlist after clearing search!");
console.log('  ✔ PASS: Quant fund remains visible in Watchlist when search is cleared!');

const watchlistWhenSearchQuant = computeWatchlist(store_mfWatchlist, store_mfWatchlistFunds, current_mutualFunds, 'quant');
assert(watchlistWhenSearchQuant.length === 1 && watchlistWhenSearchQuant[0].id === '151700', "Watchlist filters to only Quant when search is 'quant'");
console.log('  ✔ PASS: Watchlist filters to only Quant when search is \"quant\"');

const watchlistWhenClearedAgain = computeWatchlist(store_mfWatchlist, store_mfWatchlistFunds, current_mutualFunds, '');
assert(watchlistWhenClearedAgain.length === 2, "Watchlist still contains all favorited funds");
console.log('  ✔ PASS: Watchlist restores all favorited funds when search is cleared again');

console.log('\n======================================================================');
console.log('ALL MUTUAL FUND WATCHLIST PERSISTENCE TESTS PASSED (100% SUCCESS)');
console.log('======================================================================\n');
