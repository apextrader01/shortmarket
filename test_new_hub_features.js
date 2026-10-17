// test_new_hub_features.js
const assert = require('assert');
const primaryMarketsService = require('./backend/services/primaryMarketsService');

console.log('====================================================');
console.log('🚀 TESTING NEW HUB FEATURES: SCREENER, FII/DII, CALENDAR');
console.log('====================================================');

// TEST 1: Smart Money (FII / DII Institutional Pulse)
console.log('\n▶ SUITE 1: Smart Money (FII / DII Pulse)');
const smartMoney = primaryMarketsService.getSmartMoneyPulse();
assert(smartMoney && smartMoney.today, 'Smart money today object exists');
assert(smartMoney.today.fiiBuy > 0, 'fiiBuy is greater than 0');
assert(smartMoney.today.fiiSell > 0, 'fiiSell is greater than 0');
assert(typeof smartMoney.today.fiiNet === 'number', 'fiiNet is a number');
assert(typeof smartMoney.today.diiNet === 'number', 'diiNet is a number');
assert(typeof smartMoney.today.combinedNet === 'number', 'combinedNet is a number');
assert(Array.isArray(smartMoney.history) && smartMoney.history.length === 30, 'history has 30 rolling daily entries');
assert(Array.isArray(smartMoney.sectoralFlow) && smartMoney.sectoralFlow.length > 0, 'sectoral flow array exists');
assert(smartMoney.derivativesPositioning.indexFutures.longPct > 0, 'index futures longPct exists');
console.log(`  ✅ FII Net: ₹${smartMoney.today.fiiNet} Cr | DII Net: ₹${smartMoney.today.diiNet} Cr | Combined: ₹${smartMoney.today.combinedNet} Cr`);
console.log(`  ✅ 30-Day Rolling History: ${smartMoney.history.length} days | Sectoral Breakdown: ${smartMoney.sectoralFlow.length} sectors`);

// TEST 2: Corporate Actions & Earnings Calendar
console.log('\n▶ SUITE 2: Corporate Actions & Earnings Calendar');
const calendarAll = primaryMarketsService.getCorporateCalendar();
assert(calendarAll && Array.isArray(calendarAll.events), 'Calendar events array exists');
assert(calendarAll.events.length > 0, 'Calendar has events');
assert(calendarAll.counts.earnings > 0, 'Has earnings events');
assert(calendarAll.counts.dividends > 0, 'Has dividend events');
assert(calendarAll.counts.splitsBonus > 0, 'Has split/bonus events');
assert(calendarAll.counts.boardMeetings > 0, 'Has board meeting events');

// Test category filter
const earningsOnly = primaryMarketsService.getCorporateCalendar({ category: 'EARNINGS' });
assert(earningsOnly.events.every(e => e.category === 'EARNINGS'), 'Category filter EARNINGS strictly respected');

const dividendsOnly = primaryMarketsService.getCorporateCalendar({ category: 'DIVIDENDS' });
assert(dividendsOnly.events.every(e => e.category === 'DIVIDENDS'), 'Category filter DIVIDENDS strictly respected');

// Test search filter
const relianceSearch = primaryMarketsService.getCorporateCalendar({ search: 'RELIANCE' });
assert(relianceSearch.events.some(e => e.symbol === 'RELIANCE'), 'Search matches RELIANCE');
console.log(`  ✅ Calendar Events Total: ${calendarAll.events.length} (Earnings: ${calendarAll.counts.earnings}, Dividends: ${calendarAll.counts.dividends}, Splits/Bonus: ${calendarAll.counts.splitsBonus})`);

// TEST 3: Live Technical & Multi-Factor Market Screener
console.log('\n▶ SUITE 3: Live Market Screener');
const screenerAll = primaryMarketsService.getMarketScreener();
assert(screenerAll && Array.isArray(screenerAll.stocks), 'Screener stocks array exists');
assert(screenerAll.stocks.length > 0, 'Screener returned stocks');
assert(screenerAll.stocks[0].symbol, 'Stock has symbol');
assert(typeof screenerAll.stocks[0].ltp === 'number', 'Stock has numeric LTP');
assert(typeof screenerAll.stocks[0].rsi === 'number', 'Stock has RSI');
assert(typeof screenerAll.stocks[0].surgeMult === 'number', 'Stock has volume surge multiplier');

// Test Presets
const high52w = primaryMarketsService.getMarketScreener({ preset: '52W_HIGH' });
assert(high52w.stocks.every(s => s.is52wHigh), 'Preset 52W_HIGH strictly respected');

const shockers = primaryMarketsService.getMarketScreener({ preset: 'VOLUME_SHOCKER' });
assert(shockers.stocks.every(s => s.isVolumeShocker), 'Preset VOLUME_SHOCKER strictly respected');

const gainers = primaryMarketsService.getMarketScreener({ preset: 'TOP_GAINERS' });
assert(gainers.stocks.every(s => s.isTopGainer), 'Preset TOP_GAINERS strictly respected');

console.log(`  ✅ Screener Default Count: ${screenerAll.stocks.length} stocks | 52W Highs: ${high52w.stocks.length} | Volume Shockers: ${shockers.stocks.length} | Top Gainers: ${gainers.stocks.length}`);

console.log('\n====================================================');
console.log('✨ ALL 3 NEW HUB MODULE TESTS PASSED WITH 100% SUCCESS!');
console.log('====================================================');
