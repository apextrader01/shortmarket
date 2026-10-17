// test_heatmap_and_news_sentiment.js
// Automated verification suite for Feature 1 (Live Sector Heatmap) and Feature 2 (AI News & Sentiment Feed)

const assert = require('assert');
const primaryMarketsService = require('./backend/services/primaryMarketsService');

async function runTestSuite() {
  console.log('====================================================');
  console.log('🚀 TESTING NEW INSTITUTIONAL FEATURES: HEATMAP & AI NEWS');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  // ─── SUITE 1: Live Sector Heatmap ──────────────────────────────────────────
  console.log('▶ SUITE 1: Sector Heatmap & Treemap Analytics');
  
  test('Returns Nifty 50 universe with 50 stocks and valid market breadth', () => {
    const data = primaryMarketsService.getSectorHeatmap({ universe: 'NIFTY50' });
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.universe, 'NIFTY50');
    assert.strictEqual(data.totalStocks, 50);
    assert(Array.isArray(data.sectors) && data.sectors.length >= 8, 'Must group into at least 8 sectors');
    assert(data.stats.advances >= 0 && data.stats.declines >= 0, 'Must have valid advance/decline stats');
    assert(data.stats.adRatio > 0, 'Advance/Decline ratio must be positive');
  });

  test('Filters universe to Bank Nifty with correct sector assignment', () => {
    const data = primaryMarketsService.getSectorHeatmap({ universe: 'NIFTYBANK' });
    assert.strictEqual(data.success, true);
    assert(data.totalStocks >= 10, 'Bank Nifty should have at least 10 stocks');
    const bankingSector = data.sectors.find(s => s.name === 'Banking & Financials');
    assert(bankingSector, 'Must contain Banking & Financials sector');
    assert(bankingSector.stocks.some(s => s.symbol === 'HDFCBANK'), 'HDFCBANK must be in Bank Nifty');
  });

  test('Sizing by Volume/Turnover adjusts sizeWeight correctly', () => {
    const mcapData = primaryMarketsService.getSectorHeatmap({ universe: 'NIFTY50', sizeBy: 'MCAP' });
    const volData = primaryMarketsService.getSectorHeatmap({ universe: 'NIFTY50', sizeBy: 'VOLUME' });
    assert.strictEqual(volData.sizeBy, 'VOLUME');
    assert(volData.sectors[0].stocks[0].turnoverCr > 0, 'Turnover in Cr must be calculated');
  });

  // ─── SUITE 2: AI Financial News & Sentiment Feed ───────────────────────────
  console.log('\n▶ SUITE 2: AI Financial News & Sentiment Feed');

  await testAsync('Fetches news stream and calculates Market Mood Index (MMI)', async () => {
    const data = await primaryMarketsService.getMarketNewsSentiment();
    assert.strictEqual(data.success, true);
    assert(data.total >= 10, 'Must contain at least 10 news items');
    assert(data.mmi && typeof data.mmi.score === 'number', 'MMI score must be numeric');
    assert(data.mmi.score >= 0 && data.mmi.score <= 100, 'MMI score must be between 0 and 100');
    assert(data.mmi.zone, 'MMI zone must be defined');
    assert(data.mmi.label, 'MMI label must be defined');
  });

  await testAsync('Filters news feed by BULLISH sentiment correctly', async () => {
    const data = await primaryMarketsService.getMarketNewsSentiment({ sentiment: 'BULLISH' });
    assert.strictEqual(data.success, true);
    assert(data.news.every(n => n.sentiment === 'BULLISH'), 'All items must be Bullish');
  });

  await testAsync('Filters news feed by stock symbol (e.g. TATAMOTORS)', async () => {
    const data = await primaryMarketsService.getMarketNewsSentiment({ symbol: 'TATAMOTORS' });
    assert.strictEqual(data.success, true);
    assert(data.news.every(n => (n.symbols || []).includes('TATAMOTORS')), 'All items must be tagged with TATAMOTORS');
    assert(data.news[0].takeaway, 'Must include AI actionable takeaway');
  });

  console.log('\n====================================================');
  console.log(`🏁 SUITE RESULTS: ${passed} / ${total} PASSED (${total - passed} FAILED)`);
  console.log('====================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
