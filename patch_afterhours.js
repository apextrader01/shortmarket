const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const regexOldFunction = /\/\/ Smart Timeframe Cache:[\s\S]*?function getCacheDuration\(interval\) \{[\s\S]*?return 60 \* 1000; \/\/ fallback 1 min\n\}/m;

const newFunction = `// Smart Timeframe Cache: Determine cache limit based on requested resolution and Market Hours
function getCacheDuration(interval, symbol) {
  // 1. After-Hours Mega Cache Logic (Exclude MCX Commodities)
  const isCommodity = symbol && symbol.toUpperCase().includes('MCX');
  
  if (!isCommodity) {
      const now = new Date();
      const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      const hours = istTime.getHours();
      
      // If market is closed (4:00 PM to 8:59 AM IST)
      if (hours >= 16 || hours < 9) {
          // Calculate exact milliseconds until 9:00 AM IST tomorrow morning
          const next9AM = new Date(istTime);
          if (hours >= 16) {
              next9AM.setDate(next9AM.getDate() + 1);
          }
          next9AM.setHours(9, 0, 0, 0);
          return next9AM.getTime() - istTime.getTime(); // Cache expires exactly at 9:00 AM!
      }
  }

  // 2. Standard Market-Hours Smart Timeframe Logic
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

code = code.replace(regexOldFunction, newFunction);

// Update the function call from `getCacheDuration(interval)` to `getCacheDuration(interval, cleanSymbol)`
code = code.replace(/const maxAgeMs = getCacheDuration\(interval\);/g, "const maxAgeMs = getCacheDuration(interval, cleanSymbol);");

fs.writeFileSync('backend/server.js', code);
console.log('Patched server.js with After-Hours Mega Cache');
