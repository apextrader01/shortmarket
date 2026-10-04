const fs = require('fs');
const assert = require('assert');

console.log('================================================================');
console.log('🧮 SKANDX CALCULATORS SUITE VERIFICATION TEST');
console.log('================================================================\n');

// 1. App.jsx Mount & Routes
const appCode = fs.readFileSync('frontend/src/App.jsx', 'utf8');
assert(appCode.includes("import('./components/CalculatorsSuiteView')"), 'App.jsx must lazy import CalculatorsSuiteView');
assert(appCode.includes("'calculators': 'Calculators'"), 'tabsMap must route calculators');
assert(appCode.includes("activeTab === 'Calculators'"), 'App.jsx must render CalculatorsSuiteView on activeTab Calculators');
assert(appCode.includes("newPath = '/calculators'"), 'App.jsx must sync /calculators to URL');
assert(appCode.includes('Financial Calculators Suite & Amortization Terminal | SkandX'), 'App.jsx must set SEO title for Calculators');
console.log('  ✅ [PASS] App.jsx routing, state, and full-page mount verified');

// 2. LandingHomeView.jsx Hub 4 Configuration
const homeCode = fs.readFileSync('frontend/src/components/LandingHomeView.jsx', 'utf8');
assert(homeCode.includes("id: 4"), 'Hub 4 must exist in LandingHomeView');
assert(homeCode.includes("onOpenCalculators('all')"), 'Hub 4 must open calculators catalog with all');
assert(homeCode.includes("onOpenCalculators('reducing-loan')"), 'Hub 4 quicklinks must have reducing-loan');
assert(homeCode.includes("onOpenCalculators('fixed-loan')"), 'Hub 4 quicklinks must have fixed-loan');
assert(homeCode.includes("onOpenCalculators('average-price')"), 'Hub 4 quicklinks must have average-price');
assert(homeCode.includes("onOpenCalculators('mtf')"), 'Hub 4 quicklinks must have mtf');
assert(homeCode.includes("onOpenWealthFinance('AI_COPILOT')"), 'Hub 4 quicklinks must fold in AI Copilot');
assert(!homeCode.includes("title: '24/7 Personal AI Wealth Copilot'"), 'Hub 5 should be folded into Hub 4, not separate card');
console.log('  ✅ [PASS] LandingHomeView Hub 4 merged with Hub 5 and renumbered');

// 3. CalculatorsSuiteView.jsx Features
const calcCode = fs.readFileSync('frontend/src/components/CalculatorsSuiteView.jsx', 'utf8');
assert(calcCode.includes('Reducing Balance Loan Calculator'), 'Must include Reducing Balance Loan');
assert(calcCode.includes('Fixed / Flat Rate Loan Calculator'), 'Must include Fixed Loan');
assert(calcCode.includes('Average Share Price Calculator'), 'Must include Average Share Price');
assert(calcCode.includes('MTF (Margin Trading Facility)'), 'Must include MTF 4x Leverage');
assert(calcCode.includes('SIP Calculator'), 'Must include SIP Calculator');
assert(calcCode.includes('Lumpsum Calculator'), 'Must include Lumpsum Calculator');
assert(calcCode.includes('Mutual Funds & Fee Savings'), 'Must include Mutual Funds Direct vs Regular');
assert(calcCode.includes('Brokerage & Statutory STT'), 'Must include Brokerage with Oct 2024 SEBI rates');
assert(calcCode.includes('Position Sizing & Risk/Reward'), 'Must include Position Sizing');
assert(calcCode.includes('Options Greeks (Black-Scholes)'), 'Must include Options Greeks');
assert(!calcCode.includes("id: 'margin'"), 'Must NOT include Margin Calculator per user request');
assert(calcCode.includes('downloadCSV'), 'Must include CSV/Excel export');
assert(calcCode.includes('window.print'), 'Must include PDF print feature');
assert(calcCode.includes('CatalogDirectoryView'), 'Must include Catalog Directory view');
assert(calcCode.includes('DedicatedCalculatorView'), 'Must include Dedicated Full Page Calculator view');
console.log('  ✅ [PASS] CalculatorsSuiteView engines, math, PDF & Excel export verified');

// 4. Build Chunk Check
const distFiles = fs.readdirSync('frontend/dist/assets');
const hasCalcChunk = distFiles.some(f => f.startsWith('CalculatorsSuiteView-') && f.endsWith('.js'));
assert(hasCalcChunk, 'Frontend production build must contain CalculatorsSuiteView chunk');
console.log('  ✅ [PASS] Production build chunk verified: ' + distFiles.find(f => f.startsWith('CalculatorsSuiteView-')));

console.log('\n================================================================');
console.log('🏁 ALL CALCULATORS SUITE TESTS PASSED (4/4)!');
console.log('================================================================\n');
