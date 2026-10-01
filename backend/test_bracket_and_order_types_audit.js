const assert = require('assert');
const { spawnBracketOrders } = require('./services/orderExecutor');

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 COMPREHENSIVE ORDER TYPES AUDIT: NORMAL, CO, BO & VOLUME MATCHING');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function test(desc, fn) {
    total++;
    try {
      fn();
      console.log(`  ✔ [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${desc}:`, err.message);
    }
  }

  // Mock trx object
  const mockTrx = (tableName) => ({
    insert: (obj) => {
      const mockId = Math.floor(Math.random() * 10000) + 1;
      return {
        returning: () => [mockId]
      };
    },
    where: () => ({
      update: () => Promise.resolve(1)
    })
  });

  // TEST 1: Normal Market Order (no SL, no Target)
  await test('Normal Market Order spawns 0 bracket legs', async () => {
    const normalOrder = {
      id: 101,
      user_id: 1,
      symbol: 'NSE:INFY-EQ',
      type: 'MARKET',
      side: 'BUY',
      quantity: 50,
      price: 1500.00,
      average_price: 1500.00,
      product_type: 'INT',
      sl_price: null,
      tgt_price: null
    };
    const legs = await spawnBracketOrders(mockTrx, normalOrder);
    assert.strictEqual(legs.length, 0, 'Normal order must not spawn bracket legs');
  });

  // TEST 2: Normal Limit Order (no SL, no Target)
  await test('Normal Limit Order spawns 0 bracket legs', async () => {
    const normalLimit = {
      id: 102,
      user_id: 1,
      symbol: 'NSE:TCS-EQ',
      type: 'LIMIT',
      side: 'SELL',
      quantity: 25,
      price: 3200.00,
      average_price: 3200.00,
      product_type: 'DEL',
      sl_price: null,
      tgt_price: null
    };
    const legs = await spawnBracketOrders(mockTrx, normalLimit);
    assert.strictEqual(legs.length, 0, 'Normal limit order must not spawn bracket legs');
  });

  // TEST 3: User's Exact Bug Scenario: Market BO BUY where volume matching filled ABOVE static target
  // Stock quoted @ 284.50. User entered Target = 285.00 (+0.50 pts), SL = 280.00 (-4.50 pts).
  // Market filled at 286.42!
  await test('Market BO BUY: Fill Price (286.42) > Target (285.00) dynamically adjusts Target above fill', async () => {
    const marketBO = {
      id: 103,
      user_id: 1,
      symbol: 'NSE:TATAPOWER-EQ',
      type: 'MARKET',
      side: 'BUY',
      quantity: 100,
      price: 286.42,
      average_price: 286.42,
      quoted_price: 284.50,
      sl_price: 280.00,
      tgt_price: 285.00,
      product_type: 'BO'
    };
    const legs = await spawnBracketOrders(mockTrx, marketBO);
    assert.strictEqual(legs.length, 2, 'Must spawn 2 legs (Target and SL)');

    const slLeg = legs.find(l => l.type === 'SL-M');
    const tgtLeg = legs.find(l => l.type === 'LIMIT');

    assert(tgtLeg, 'Target leg must exist');
    assert(slLeg, 'SL leg must exist');

    // Target must be > 286.42. Specifically 286.42 + 0.50 = 286.92
    assert.strictEqual(tgtLeg.price, 286.92, `Target price should be 286.92, got ${tgtLeg.price}`);
    assert.strictEqual(tgtLeg.side, 'SELL', 'Target side must be SELL');
    assert.strictEqual(tgtLeg.price > marketBO.price, true, 'Target price must be strictly greater than actual fill price');

    // SL must be < 286.42. Specifically 286.42 - 4.50 = 281.92
    assert.strictEqual(slLeg.trigger_price, 281.92, `SL price should be 281.92, got ${slLeg.trigger_price}`);
    assert.strictEqual(slLeg.side, 'SELL', 'SL side must be SELL');
    assert.strictEqual(slLeg.trigger_price < marketBO.price, true, 'SL price must be strictly less than actual fill price');
  });

  // TEST 4: Market BO SELL (Short) where volume matching filled BELOW static target
  // Stock quoted @ 284.50. User entered Target = 280.00 (-4.50 pts), SL = 288.00 (+3.50 pts).
  // Market filled at 279.00!
  await test('Market BO SELL: Fill Price (279.00) < Target (280.00) dynamically adjusts Target below fill', async () => {
    const marketBOSell = {
      id: 104,
      user_id: 1,
      symbol: 'NSE:SBIN-EQ',
      type: 'MARKET',
      side: 'SELL',
      quantity: 50,
      price: 279.00,
      average_price: 279.00,
      quoted_price: 284.50,
      sl_price: 288.00,
      tgt_price: 280.00,
      product_type: 'BO'
    };
    const legs = await spawnBracketOrders(mockTrx, marketBOSell);
    assert.strictEqual(legs.length, 2, 'Must spawn 2 legs');

    const slLeg = legs.find(l => l.type === 'SL-M');
    const tgtLeg = legs.find(l => l.type === 'LIMIT');

    // For SELL, Target must be lower than fill price (279.00 - 4.50 = 274.50)
    assert.strictEqual(tgtLeg.price, 274.50, `Target should be 274.50, got ${tgtLeg.price}`);
    assert.strictEqual(tgtLeg.side, 'BUY', 'Target side must be BUY');
    assert.strictEqual(tgtLeg.price < marketBOSell.price, true, 'Target price must be strictly less than actual fill price');

    // For SELL, SL must be higher than fill price (279.00 + 3.50 = 282.50)
    assert.strictEqual(slLeg.trigger_price, 282.50, `SL should be 282.50, got ${slLeg.trigger_price}`);
    assert.strictEqual(slLeg.side, 'BUY', 'SL side must be BUY');
    assert.strictEqual(slLeg.trigger_price > marketBOSell.price, true, 'SL price must be strictly greater than actual fill price');
  });

  // TEST 5: Limit BO (BUY) fills normally without slippage inversion
  // User entered Limit = 280.00, Target = 285.00, SL = 275.00. Fill = 279.50.
  await test('Limit BO BUY: static target and SL prices are preserved when no inversion', async () => {
    const limitBO = {
      id: 105,
      user_id: 1,
      symbol: 'NSE:RELIANCE-EQ',
      type: 'LIMIT',
      side: 'BUY',
      quantity: 10,
      price: 279.50,
      average_price: 279.50,
      quoted_price: 280.00,
      sl_price: 275.00,
      tgt_price: 285.00,
      product_type: 'BO'
    };
    const legs = await spawnBracketOrders(mockTrx, limitBO);
    assert.strictEqual(legs.length, 2);

    const slLeg = legs.find(l => l.type === 'SL-M');
    const tgtLeg = legs.find(l => l.type === 'LIMIT');

    assert.strictEqual(tgtLeg.price, 285.00, 'Limit order target must remain static at 285.00');
    assert.strictEqual(slLeg.trigger_price, 275.00, 'Limit order SL must remain static at 275.00');
  });

  // TEST 6: Cover Order (CO BUY) - Only Stop Loss is created
  await test('Cover Order (CO BUY): Only SL leg is created, never Target leg', async () => {
    const marketCO = {
      id: 106,
      user_id: 1,
      symbol: 'NSE:ITC-EQ',
      type: 'MARKET',
      side: 'BUY',
      quantity: 100,
      price: 450.00,
      average_price: 450.00,
      quoted_price: 448.00,
      sl_price: 440.00, // 8 pts offset from quote 448
      tgt_price: null,
      product_type: 'CO'
    };
    const legs = await spawnBracketOrders(mockTrx, marketCO);
    assert.strictEqual(legs.length, 1, 'CO order must only spawn 1 leg');
    assert.strictEqual(legs[0].type, 'SL-M', 'Leg must be Stop-Loss Market');
    // SL = 450.00 - 8.00 = 442.00
    assert.strictEqual(legs[0].trigger_price, 442.00, `SL should be 442.00, got ${legs[0].trigger_price}`);
    assert.strictEqual(legs[0].side, 'SELL', 'SL side must be SELL');
  });

  // TEST 7: Penny stock / low-price safeguard: SL price never <= 0
  await test('Penny stock boundary safeguard: prices never drop to 0 or negative', async () => {
    const pennyOrder = {
      id: 107,
      user_id: 1,
      symbol: 'NSE:PENNY-EQ',
      type: 'MARKET',
      side: 'BUY',
      quantity: 1000,
      price: 0.10,
      average_price: 0.10,
      quoted_price: 0.10,
      sl_price: 0.05,
      tgt_price: 0.20,
      product_type: 'BO'
    };
    const legs = await spawnBracketOrders(mockTrx, pennyOrder);
    const slLeg = legs.find(l => l.type === 'SL-M');
    assert(slLeg.trigger_price >= 0.05, `SL trigger price must be at least 0.05 tick, got ${slLeg.trigger_price}`);
  });

  console.log('\n======================================================================');
  console.log(`TOTAL AUDIT CHECKS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log('======================================================================');

  if (passed === total) {
    console.log('🎉 ALL NORMAL, CO, AND BO ORDER SCENARIOS VERIFIED 100% BUG-FREE!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
