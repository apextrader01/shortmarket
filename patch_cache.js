const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const regexCacheConstant = /const CACHE_DURATION_MS = 60 \* 1000; \/\/ 1 minute cache/;
const newCacheConstant = `// Smart Timeframe Cache: Determine cache limit based on requested resolution
function getCacheDuration(interval) {
  if (interval === '1') return 60 * 1000; // 1 min
  if (interval === '2') return 2 * 60 * 1000;
  if (interval === '3') return 3 * 60 * 1000;
  if (interval === '5') return 5 * 60 * 1000;
  if (interval === '10') return 10 * 60 * 1000;
  if (interval === '15') return 15 * 60 * 1000;
  if (interval === '30') return 30 * 60 * 1000;
  if (interval === '60' || interval === '1H') return 60 * 60 * 1000; // 1 hr
  if (interval === 'D' || interval === '1D' || interval === 'ONE_DAY') return 12 * 60 * 60 * 1000; // 12 hours
  return 60 * 1000; // fallback 1 min
}`;

code = code.replace(regexCacheConstant, newCacheConstant);

const regexLogic = /if \(candleCache\[cacheKey\] && \(now - candleCache\[cacheKey\]\.timestamp < CACHE_DURATION_MS\)\) \{/m;
const newLogic = `const maxAgeMs = getCacheDuration(interval);
      if (candleCache[cacheKey] && (now - candleCache[cacheKey].timestamp < maxAgeMs)) {`;

code = code.replace(regexLogic, newLogic);

fs.writeFileSync('backend/server.js', code);
console.log('Patched server.js with Smart Timeframe Cache');
