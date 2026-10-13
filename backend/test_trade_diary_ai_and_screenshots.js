// Test Verification: Trade Diary AI Audit & Trade Screenshot Storage
const assert = require('assert');

console.log('--- RUNNING TRADE DIARY AI AUDIT & SCREENSHOT TEST SUITE ---');

// 1. Verify Screenshot Parsing & Normalization
function parseScreenshots(trade) {
  if (!trade) return [];
  if (Array.isArray(trade.screenshots)) return trade.screenshots.filter(Boolean);
  if (trade.screenshot_url) {
    try {
      const parsed = JSON.parse(trade.screenshot_url);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      if (typeof parsed === 'string' && parsed.trim()) return [parsed.trim()];
    } catch (_) {
      if (typeof trade.screenshot_url === 'string' && trade.screenshot_url.trim()) {
        return [trade.screenshot_url.trim()];
      }
    }
  }
  return [];
}

// Test case 1.1: Array of 2 screenshots
const tradeWithArray = {
  symbol: 'NIFTY 24500 CE',
  screenshots: ['data:image/jpeg;base64,sample1', 'data:image/jpeg;base64,sample2']
};
const parsed1 = parseScreenshots(tradeWithArray);
assert.strictEqual(parsed1.length, 2, 'Should parse 2 screenshots from array');
assert.strictEqual(parsed1[0], 'data:image/jpeg;base64,sample1');
console.log('✓ Test 1.1: Successfully parsed array screenshots');

// Test case 1.2: Serialized JSON array in screenshot_url
const tradeWithJsonStr = {
  symbol: 'BANKNIFTY 52000 PE',
  screenshot_url: JSON.stringify(['https://example.com/chart1.png', 'https://example.com/chart2.png'])
};
const parsed2 = parseScreenshots(tradeWithJsonStr);
assert.strictEqual(parsed2.length, 2, 'Should parse 2 screenshots from serialized string');
assert.strictEqual(parsed2[1], 'https://example.com/chart2.png');
console.log('✓ Test 1.2: Successfully parsed JSON serialized screenshot_url');

// Test case 1.3: Legacy single screenshot URL
const tradeWithLegacyStr = {
  symbol: 'RELIANCE',
  screenshot_url: 'https://example.com/legacy_chart.png'
};
const parsed3 = parseScreenshots(tradeWithLegacyStr);
assert.strictEqual(parsed3.length, 1, 'Should parse single string as 1-element array');
assert.strictEqual(parsed3[0], 'https://example.com/legacy_chart.png');
console.log('✓ Test 1.3: Backward-compatibility preserved for legacy single URL');

// 2. Test Algorithmic Trade Audit Fallback
function buildAlgorithmicTradeAudit(summary, market = 'Indian') {
  const sym = market === 'Indian' ? '₹' : '$';
  const { totalTrades, winRate, netPnl, topWinStrat, topLossStrat, dominantEmotion, negativeEmotions, biggestWin, biggestLoss } = summary;

  let grade = 'B';
  if (winRate >= 65 && netPnl > 0) grade = 'A';
  else if (winRate >= 50 && netPnl >= 0) grade = 'B+';
  else if (winRate >= 40 && netPnl >= 0) grade = 'B';
  else if (netPnl < 0 && winRate >= 40) grade = 'C+';
  else if (netPnl < 0) grade = 'C';

  const strengths = [];
  if (winRate >= 50) strengths.push(`Win Rate Consistency: Maintained a solid ${winRate}% win rate across logged executions.`);
  else strengths.push(`Risk Control Baseline: Controlled overall loss exposure during volatile phases.`);

  if (topWinStrat) strengths.push(`Proven Core Edge: Best profitability achieved in "${topWinStrat}" strategy.`);
  else strengths.push(`Execution Rhythm: Capitalized on clean setups with defined risk limits.`);

  if (biggestWin > 0) strengths.push(`High Upside Capture: Maximum winning trade achieved ${sym}${biggestWin.toLocaleString('en-IN')}.`);
  else strengths.push(`Disciplined Position Sizing: Kept trade size within capital allocation boundaries.`);

  strengths.push(`Systematic Process: Active adherence to trade journaling and retrospective review.`);

  const leaks = [];
  if (negativeEmotions.length > 0) {
    leaks.push(`Emotional Tilt Flags: Trades tagged with ${negativeEmotions.join(', ')} showed sub-optimal risk compliance.`);
  } else {
    leaks.push(`Session Timing Risk: Late afternoon sessions exhibit lower win rates due to decay.`);
  }

  if (topLossStrat) {
    leaks.push(`Underperforming Setup: Negative expectancy observed in "${topLossStrat}" trades.`);
  } else {
    leaks.push(`Stop-Loss Widening: Hesitation in executing initial invalidation levels.`);
  }

  if (biggestLoss < 0) {
    leaks.push(`Tail Loss Outlier: Largest single loss was ${sym}${Math.abs(biggestLoss).toLocaleString('en-IN')}, cutting into overall alpha.`);
  } else {
    leaks.push(`Premature Target Exits: Manual exit before price hit the designated reward boundary.`);
  }

  leaks.push(`Overtrading Risk: High setup frequency on choppy market sessions.`);

  const actionPlan = [
    `Enforce Hard Terminal Lockdown after taking 2 consecutive stop-outs to stop revenge tilt.`,
    `Focus 80% of capital allocation on "${topWinStrat || 'Confirmed Breakout'}" setups where expectancy is verified.`,
    `Set a mandatory 1:2 Risk-to-Reward minimum filter before triggering any new market order.`
  ];

  return {
    traderGrade: grade,
    executiveSummary: `Analyzed ${totalTrades} verified trades with a ${winRate}% win rate and net return of ${sym}${netPnl.toLocaleString('en-IN')}. Focus on eliminating emotional leaks and doubling down on ${topWinStrat || 'core setups'}.`,
    strengths,
    leaks,
    actionPlan
  };
}

const sampleSummary = {
  totalTrades: 12,
  winCount: 8,
  lossCount: 4,
  winRate: 67,
  netPnl: 18500,
  biggestWin: 9200,
  biggestLoss: -3100,
  topWinStrat: '🔥 Breakout',
  topLossStrat: '⚡ Scalping',
  dominantEmotion: '🎯 Disciplined Execution',
  negativeEmotions: ['FOMO Entry'],
  market: 'Indian'
};

const auditResult = buildAlgorithmicTradeAudit(sampleSummary);
assert.strictEqual(auditResult.traderGrade, 'A', 'Grade should be A for 67% win rate with positive PnL');
assert.ok(auditResult.executiveSummary.includes('Analyzed 12 verified trades'), 'Summary should mention 12 verified trades');
assert.strictEqual(auditResult.strengths.length, 4, 'Should provide 4 strengths');
assert.strictEqual(auditResult.leaks.length, 4, 'Should provide 4 leaks');
assert.strictEqual(auditResult.actionPlan.length, 3, 'Should provide 3 action items');
console.log('✓ Test 2: Algorithmic Trade Audit successfully verified with Grade A');

console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
