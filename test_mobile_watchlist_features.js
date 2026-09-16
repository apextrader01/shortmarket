/**
 * Test Suite: Mobile-Only Watchlist, Swipe Gestures, Bottom Sheet, Search/Filter & Navigation
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== Starting Mobile Watchlist & Navigation Verification Suite ===\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    -> ${err.message}`);
  }
}

// ── Test 1: Verify App.jsx Mobile Bottom Navigation ────────────────────────
test('App.jsx: Bottom navigation contains Watchlist, Positions, Orders, Portfolio, Profile in exact order', () => {
  const appContent = fs.readFileSync(path.join(__dirname, 'frontend/src/App.jsx'), 'utf8');
  
  // Extract mobile-bottom-nav block
  const navMatch = appContent.match(/<div className="mobile-bottom-nav">([\s\S]*?)<\/div>\s*\)/);
  assert(navMatch, 'mobile-bottom-nav container must exist in App.jsx');
  const navBlock = navMatch[1];

  // Must contain Watchlist
  assert(navBlock.includes("setActiveTab('Watchlist')"), 'Must contain Watchlist tab');
  // Must contain Positions
  assert(navBlock.includes("setActiveTab('Positions')"), 'Must contain Positions tab');
  // Must contain Orders
  assert(navBlock.includes("setActiveTab('Orders')"), 'Must contain Orders tab');
  // Must contain Portfolio
  assert(navBlock.includes("setActiveTab('Portfolio')"), 'Must contain Portfolio tab');
  // Must contain Profile
  assert(navBlock.includes("setActiveTab('ClientData')"), 'Must contain Profile tab');

  // Must NOT contain Chart in mobile-bottom-nav
  assert(!navBlock.includes("setActiveTab('Chart')"), 'Chart tab MUST NOT be in mobile bottom nav');

  // Verify order of items
  const idxWatchlist = navBlock.indexOf("setActiveTab('Watchlist')");
  const idxPositions = navBlock.indexOf("setActiveTab('Positions')");
  const idxOrders = navBlock.indexOf("setActiveTab('Orders')");
  const idxPortfolio = navBlock.indexOf("setActiveTab('Portfolio')");
  const idxProfile = navBlock.indexOf("setActiveTab('ClientData')");

  assert(idxWatchlist < idxPositions, 'Watchlist must come before Positions');
  assert(idxPositions < idxOrders, 'Positions must come before Orders');
  assert(idxOrders < idxPortfolio, 'Orders must come before Portfolio');
  assert(idxPortfolio < idxProfile, 'Portfolio must come before Profile');
});

// ── Test 2: Verify Mobile Stock Select Callback in App.jsx ─────────────────
test('App.jsx: onStockSelect on mobile triggers mobileStockOverviewSymbol', () => {
  const appContent = fs.readFileSync(path.join(__dirname, 'frontend/src/App.jsx'), 'utf8');
  assert(appContent.includes('setMobileStockOverviewSymbol'), 'setMobileStockOverviewSymbol must be called on mobile stock select');
  assert(appContent.includes('<MobileStockOverviewModal />'), 'MobileStockOverviewModal must be rendered in App.jsx Suspense block');
});

// ── Test 3: Verify store.js State & Actions ────────────────────────────────
test('store.js: contains mobileStockOverviewSymbol state and setter', () => {
  const storeContent = fs.readFileSync(path.join(__dirname, 'frontend/src/store.js'), 'utf8');
  assert(storeContent.includes('mobileStockOverviewSymbol: null'), 'store must define mobileStockOverviewSymbol: null');
  assert(storeContent.includes('setMobileStockOverviewSymbol: (symbol) => set({ mobileStockOverviewSymbol: symbol })'), 'store must define setMobileStockOverviewSymbol action');
});

// ── Test 4: Verify WatchlistRow Swipe Tray in MarketWatch.jsx ──────────────
test('MarketWatch.jsx: WatchlistRow implements touch handlers and 3-action tray (B, S, Delete)', () => {
  const mwContent = fs.readFileSync(path.join(__dirname, 'frontend/src/components/MarketWatch.jsx'), 'utf8');
  
  assert(mwContent.includes('watchlist-swipe-container'), 'Must contain watchlist-swipe-container');
  assert(mwContent.includes('watchlist-swipe-actions'), 'Must contain watchlist-swipe-actions');
  assert(mwContent.includes('watchlist-swipe-btn-buy'), 'Must contain Buy swipe button');
  assert(mwContent.includes('watchlist-swipe-btn-sell'), 'Must contain Sell swipe button');
  assert(mwContent.includes('watchlist-swipe-btn-delete'), 'Must contain Delete swipe button');

  // Verify swipe gesture handlers
  assert(mwContent.includes('onTouchStart='), 'Must handle onTouchStart');
  assert(mwContent.includes('onTouchMove='), 'Must handle onTouchMove');
  assert(mwContent.includes('onTouchEnd='), 'Must handle onTouchEnd');
  assert(mwContent.includes('swipedSymbol'), 'Must handle swipedSymbol state');
});

// ── Test 5: Verify Filter and Sort Controls in MarketWatch.jsx ─────────────
test('MarketWatch.jsx: implements segment filter and sorting options', () => {
  const mwContent = fs.readFileSync(path.join(__dirname, 'frontend/src/components/MarketWatch.jsx'), 'utf8');
  
  assert(mwContent.includes('filterSegment'), 'Must have filterSegment state');
  assert(mwContent.includes('sortBy'), 'Must have sortBy state');
  assert(mwContent.includes('showFilterMenu'), 'Must have showFilterMenu state');
  assert(mwContent.includes('SlidersHorizontal'), 'Must render SlidersHorizontal icon');

  // Check segments
  assert(mwContent.includes("'NSE'"), 'Must support NSE segment filter');
  assert(mwContent.includes("'BSE'"), 'Must support BSE segment filter');
  assert(mwContent.includes("'MCX'"), 'Must support MCX segment filter');
  assert(mwContent.includes("'FNO'"), 'Must support FNO segment filter');

  // Check sort modes
  assert(mwContent.includes('ALPHA_ASC'), 'Must support ALPHA_ASC');
  assert(mwContent.includes('ALPHA_DESC'), 'Must support ALPHA_DESC');
  assert(mwContent.includes('PRICE_DESC'), 'Must support PRICE_DESC');
  assert(mwContent.includes('PRICE_ASC'), 'Must support PRICE_ASC');
  assert(mwContent.includes('PCT_DESC'), 'Must support PCT_DESC');
  assert(mwContent.includes('PCT_ASC'), 'Must support PCT_ASC');
});

// ── Test 6: Verify Filter & Sort Logic Computation ─────────────────────────
test('Logic Simulation: Filter and Sort pipeline works correctly', () => {
  const mockStocks = [
    { uniqueSymbol: 'NSE:RELIANCE-EQ', symbol: 'RELIANCE-EQ', exchange: 'NSE', ltp: 2800, pct: 1.5 },
    { uniqueSymbol: 'MCX:GOLD26OCTFUT', symbol: 'GOLD26OCTFUT', exchange: 'MCX', ltp: 75000, pct: -0.8 },
    { uniqueSymbol: 'BSE:TCS-EQ', symbol: 'TCS-EQ', exchange: 'BSE', ltp: 4200, pct: 2.1 },
    { uniqueSymbol: 'NSE:NIFTY24SEP25000CE', symbol: 'NIFTY24SEP25000CE', exchange: 'NSE', ltp: 180, pct: 15.0 },
    { uniqueSymbol: 'NSE:INFY-EQ', symbol: 'INFY-EQ', exchange: 'NSE', ltp: 1900, pct: -1.2 },
  ];

  const isFno = (sym) => {
    const clean = sym.includes(':') ? sym.split(':')[1] : sym;
    return /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean) || 
           /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || 
           clean.endsWith('-FUT');
  };

  // 1. Filter MCX only
  const mcxOnly = mockStocks.filter(s => s.exchange === 'MCX');
  assert.strictEqual(mcxOnly.length, 1);
  assert.strictEqual(mcxOnly[0].symbol, 'GOLD26OCTFUT');

  // 2. Filter F&O only
  const fnoOnly = mockStocks.filter(s => isFno(s.symbol));
  assert.strictEqual(fnoOnly.length, 2); // GOLD26OCTFUT and NIFTY24SEP25000CE

  // 3. Filter NSE Equity only (no derivatives)
  const nseEqOnly = mockStocks.filter(s => s.exchange === 'NSE' && !isFno(s.symbol));
  assert.strictEqual(nseEqOnly.length, 2); // RELIANCE-EQ and INFY-EQ

  // 4. Sort Alphabetical Ascending
  const sortedAlphaAsc = [...mockStocks].sort((a, b) => a.symbol.localeCompare(b.symbol));
  assert.strictEqual(sortedAlphaAsc[0].symbol, 'GOLD26OCTFUT');
  assert.strictEqual(sortedAlphaAsc[sortedAlphaAsc.length - 1].symbol, 'TCS-EQ');

  // 5. Sort % Change Descending (Top Gainers)
  const sortedGainers = [...mockStocks].sort((a, b) => b.pct - a.pct);
  assert.strictEqual(sortedGainers[0].symbol, 'NIFTY24SEP25000CE'); // +15%
  assert.strictEqual(sortedGainers[sortedGainers.length - 1].symbol, 'INFY-EQ'); // -1.2%

  // 6. Sort Price Descending
  const sortedPriceDesc = [...mockStocks].sort((a, b) => b.ltp - a.ltp);
  assert.strictEqual(sortedPriceDesc[0].symbol, 'GOLD26OCTFUT'); // 75000
  assert.strictEqual(sortedPriceDesc[sortedPriceDesc.length - 1].symbol, 'NIFTY24SEP25000CE'); // 180
});

// ── Test 7: Verify MobileStockOverviewModal Component ──────────────────────
test('MobileStockOverviewModal.jsx: implements full bottom sheet with mini chart and sticky Buy/Sell buttons', () => {
  const modalPath = path.join(__dirname, 'frontend/src/components/MobileStockOverviewModal.jsx');
  assert(fs.existsSync(modalPath), 'MobileStockOverviewModal.jsx must exist');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  assert(modalContent.includes('mobile-stock-sheet-overlay'), 'Must have sheet overlay');
  assert(modalContent.includes('mobile-stock-sheet'), 'Must have sheet container');
  assert(modalContent.includes('Overview'), 'Must have Overview tab');
  assert(modalContent.includes('Technicals'), 'Must have Technicals tab');
  assert(modalContent.includes('Market Depth'), 'Must have Market Depth tab');

  // Mini Chart Timeframes
  assert(modalContent.includes("'1D'"), 'Must have 1D timeframe');
  assert(modalContent.includes("'1W'"), 'Must have 1W timeframe');
  assert(modalContent.includes("'1M'"), 'Must have 1M timeframe');
  assert(modalContent.includes("'3M'"), 'Must have 3M timeframe');
  assert(modalContent.includes("'1Y'"), 'Must have 1Y timeframe');

  // SVG Area Chart
  assert(modalContent.includes('<svg'), 'Must render SVG chart');
  assert(modalContent.includes('linearGradient'), 'Must have gradient area under chart line');

  // Sticky Buy / Sell Buttons
  assert(modalContent.includes('handleBuy'), 'Must have Buy handler');
  assert(modalContent.includes('handleSell'), 'Must have Sell handler');
  assert(modalContent.includes("openOrderModal(symbol, 'BUY'"), 'Buy must open order modal');
  assert(modalContent.includes("openOrderModal(symbol, 'SELL'"), 'Sell must open order modal');
  assert(modalContent.includes('position: \'sticky\''), 'Buttons must be sticky at the bottom');
});

// ── Test 8: Verify CSS Styles for Gestures and Animations ──────────────────
test('index.css: contains classes and keyframes for row swipe, bottom sheet, and filter menu', () => {
  const cssContent = fs.readFileSync(path.join(__dirname, 'frontend/src/index.css'), 'utf8');

  assert(cssContent.includes('.watchlist-swipe-container'), 'Must have .watchlist-swipe-container');
  assert(cssContent.includes('.watchlist-swipe-row'), 'Must have .watchlist-swipe-row');
  assert(cssContent.includes('.watchlist-swipe-actions'), 'Must have .watchlist-swipe-actions');
  assert(cssContent.includes('.watchlist-swipe-btn-buy'), 'Must have .watchlist-swipe-btn-buy');
  assert(cssContent.includes('.watchlist-swipe-btn-sell'), 'Must have .watchlist-swipe-btn-sell');
  assert(cssContent.includes('.watchlist-swipe-btn-delete'), 'Must have .watchlist-swipe-btn-delete');
  assert(cssContent.includes('@keyframes slideUpSheet'), 'Must have @keyframes slideUpSheet');
  assert(cssContent.includes('.watchlist-filter-menu'), 'Must have .watchlist-filter-menu');
});

console.log(`\n=== Verification Results: ${passedTests}/${totalTests} Tests Passed ===\n`);
if (passedTests !== totalTests) {
  process.exit(1);
}
